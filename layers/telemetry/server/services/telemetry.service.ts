import { z } from 'zod'
import type { Prisma } from '~~/generated/prisma/client'
import { usePrisma } from '~~/server/core/prisma'
import { eventBus } from '~~/server/core/event-bus'
import { DOMAIN_THRESHOLDS } from '~~/shared/domain/thresholds'
import type {
	AlarmSummary,
	TelemetryPoint,
	TelemetryReportInput,
	TelemetryReportResult,
	TelemetryValue,
} from '~~/shared/contracts/telemetry'
import type { PageResult } from '~~/shared/contracts/api'

const telemetryValueSchema = z.union([z.number(), z.boolean()])

export const reportInputSchema = z.object({
	deviceCode: z.string().min(1),
	reportedAt: z.string().datetime({ offset: true }),
	props: z.record(z.string(), telemetryValueSchema),
})

const THRESHOLD_CHECKS: Array<{
	identifier: string
	threshold: number
}> = [
	{
		identifier: 'motor_drive_bearing_temp',
		threshold: DOMAIN_THRESHOLDS.motorDriveBearingTemperatureCelsius,
	},
	{
		identifier: 'pump_vibration_x',
		threshold: DOMAIN_THRESHOLDS.pumpVibrationXMillimetersPerSecond,
	},
	{ identifier: 'inverter_current', threshold: DOMAIN_THRESHOLDS.inverterCurrentAmpere },
]

export class TelemetryError extends Error {
	constructor(
		public readonly code: 'VALIDATION_ERROR' | 'REPORT_REJECTED' | 'NOT_FOUND',
		message: string,
	) {
		super(message)
		this.name = 'TelemetryError'
	}
}

function mapValueFields(value: TelemetryValue) {
	return {
		valueNumber: typeof value === 'number' ? value : null,
		valueBoolean: typeof value === 'boolean' ? value : null,
	}
}

export async function reportTelemetry(raw: unknown): Promise<TelemetryReportResult> {
	const input = reportInputSchema.parse(raw) as TelemetryReportInput
	const prisma = usePrisma()

	const device = await prisma.device.findUnique({
		where: { deviceCode: input.deviceCode },
		select: { id: true, deviceCode: true, productId: true, status: true, deletedAt: true },
	})

	if (!device || device.deletedAt || device.status !== 'ENABLED') {
		throw new TelemetryError('REPORT_REJECTED', `设备 ${input.deviceCode} 不存在、已删除或未启用`)
	}

	const properties = await prisma.productProperty.findMany({
		where: { productId: device.productId },
		select: { identifier: true, dataType: true },
	})
	const propertyMap = new Map(properties.map((p) => [p.identifier, p.dataType]))

	const acceptedProps: Record<string, TelemetryValue> = {}
	const rejectedProps: string[] = []

	for (const [key, value] of Object.entries(input.props)) {
		const dataType = propertyMap.get(key)
		if (!dataType) {
			rejectedProps.push(`${key}(未知属性)`)
			continue
		}
		if (dataType === 'BOOL' && typeof value !== 'boolean') {
			rejectedProps.push(`${key}(类型不匹配，期望 BOOL)`)
			continue
		}
		if (dataType === 'DOUBLE' && typeof value !== 'number') {
			rejectedProps.push(`${key}(类型不匹配，期望 DOUBLE)`)
			continue
		}
		acceptedProps[key] = value
	}

	if (rejectedProps.length > 0) {
		throw new TelemetryError('VALIDATION_ERROR', `属性校验失败: ${rejectedProps.join(', ')}`)
	}

	const reportedAt = new Date(input.reportedAt)

	const { report, createdAlarms } = await prisma.$transaction(async (tx) => {
		const created = await tx.telemetryReport.create({
			data: {
				deviceId: device.id,
				reportedAt,
				rawJson: acceptedProps as Prisma.InputJsonValue,
			},
		})

		await tx.telemetryValue.createMany({
			data: Object.entries(acceptedProps).map(([identifier, value]) => ({
				reportId: created.id,
				propertyIdentifier: identifier,
				...mapValueFields(value),
			})),
		})

		for (const [identifier, value] of Object.entries(acceptedProps)) {
			await tx.deviceLatestValue.upsert({
				where: {
					deviceId_propertyIdentifier: {
						deviceId: device.id,
						propertyIdentifier: identifier,
					},
				},
				update: { ...mapValueFields(value), reportedAt },
				create: {
					deviceId: device.id,
					propertyIdentifier: identifier,
					...mapValueFields(value),
					reportedAt,
				},
			})
		}

		// Device 的在线、数据截至与 Dashboard 延迟口径均以成功上报时间为准。
		// 必须与报告、最新值和报警在同一 transaction 中提交，避免投影不一致。
		await tx.device.update({
			where: { id: device.id },
			data: { lastReportedAt: reportedAt },
		})

		const alarms: Array<{ id: number; metric: string }> = []
		for (const { identifier, threshold } of THRESHOLD_CHECKS) {
			const v = acceptedProps[identifier]
			if (typeof v !== 'number' || v <= threshold) continue

			const alarm = await tx.alarm.create({
				data: {
					deviceId: device.id,
					metric: identifier,
					threshold,
					actualValue: v,
					level: 'WARNING',
					status: 'UNHANDLED',
					occurredAt: reportedAt,
				},
			})
			alarms.push({ id: alarm.id, metric: identifier })
		}

		return { report: created, createdAlarms: alarms }
	})

	await eventBus.emit('telemetry.reported', {
		reportId: String(report.id),
		deviceId: String(device.id),
		deviceCode: device.deviceCode,
		reportedAt: input.reportedAt,
		props: acceptedProps,
	})

	for (const alarm of createdAlarms) {
		await eventBus.emit('alarm.created', {
			alarmId: String(alarm.id),
			deviceId: String(device.id),
			metric: alarm.metric,
			level: 'WARNING',
			occurredAt: input.reportedAt,
		})
	}

	return {
		reportId: String(report.id),
		acceptedPropertyCount: Object.keys(acceptedProps).length,
		alarmTriggered: createdAlarms.length > 0,
	}
}

export const historyQuerySchema = z
	.object({
		deviceIds: z
			.string()
			.min(1)
			.transform((s) => s.split(',').map((p) => p.trim()))
			.refine((arr) => arr.every((p) => /^\d+$/.test(p)), {
				message: 'deviceIds 必须为逗号分隔的数字 ID',
			}),
		propertyIdentifier: z.string().min(1),
		start: z.string().datetime({ offset: true }),
		end: z.string().datetime({ offset: true }),
	})
	.refine((value) => new Date(value.start) < new Date(value.end), {
		path: ['end'],
		message: '结束时间必须晚于开始时间',
	})

export async function queryHistory(raw: unknown): Promise<TelemetryPoint[]> {
	const input = historyQuerySchema.parse(raw)
	const prisma = usePrisma()
	const ids = input.deviceIds.map((s) => Number(s))

	const devices = await prisma.device.findMany({
		where: { id: { in: ids } },
		select: { id: true, deviceCode: true },
	})
	const deviceMap = new Map(devices.map((d) => [d.id, d.deviceCode]))

	const values = await prisma.telemetryValue.findMany({
		where: {
			propertyIdentifier: input.propertyIdentifier,
			report: {
				deviceId: { in: devices.map((d) => d.id) },
				reportedAt: { gte: new Date(input.start), lte: new Date(input.end) },
			},
		},
		include: { report: { select: { deviceId: true, reportedAt: true } } },
		orderBy: { report: { reportedAt: 'asc' } },
	})

	return values.map((v) => {
		const value: TelemetryValue =
			v.valueNumber !== null ? Number(v.valueNumber) : (v.valueBoolean ?? false)
		return {
			deviceId: String(v.report.deviceId),
			deviceCode: deviceMap.get(v.report.deviceId) ?? '',
			propertyIdentifier: v.propertyIdentifier,
			value,
			reportedAt: v.report.reportedAt.toISOString(),
		}
	})
}

export const alarmQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(100).default(20),
	status: z.enum(['UNHANDLED', 'ACKNOWLEDGED', 'RECOVERED', 'IGNORED']).optional(),
	level: z.enum(['WARNING', 'SERIOUS']).optional(),
	deviceId: z.string().regex(/^\d+$/).optional(),
})

export async function queryAlarms(raw: unknown): Promise<PageResult<AlarmSummary>> {
	const input = alarmQuerySchema.parse(raw)
	const prisma = usePrisma()

	let deviceIdNum: number | undefined
	if (input.deviceId) {
		deviceIdNum = Number(input.deviceId)
		const device = await prisma.device.findUnique({
			where: { id: deviceIdNum },
			select: { id: true },
		})
		if (!device) {
			return { items: [], page: input.page, pageSize: input.pageSize, total: 0 }
		}
	}

	const where: Prisma.AlarmWhereInput = {}
	if (input.status) where.status = input.status
	if (input.level) where.level = input.level
	if (deviceIdNum) where.deviceId = deviceIdNum

	const [total, rows] = await Promise.all([
		prisma.alarm.count({ where }),
		prisma.alarm.findMany({
			where,
			include: { device: { select: { deviceCode: true } } },
			orderBy: { occurredAt: 'desc' },
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		}),
	])

	return {
		items: rows.map((a) => ({
			id: String(a.id),
			deviceId: String(a.deviceId),
			deviceCode: a.device.deviceCode,
			metric: a.metric,
			threshold: Number(a.threshold),
			actualValue: Number(a.actualValue),
			level: a.level,
			status: a.status,
			occurredAt: a.occurredAt.toISOString(),
			handledAt: a.handledAt?.toISOString() ?? null,
		})),
		page: input.page,
		pageSize: input.pageSize,
		total,
	}
}
