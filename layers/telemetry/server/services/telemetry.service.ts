import { z } from 'zod'
import type { Prisma } from '~~/generated/prisma/client'
import { usePrisma } from '~~/server/core/prisma'
import { eventBus } from '~~/server/core/event-bus'
import { DOMAIN_THRESHOLDS } from '~~/shared/domain/thresholds'
import type {
	AlarmStatus,
	AlarmSummary,
	TelemetryPoint,
	TelemetryReportInput,
	TelemetryReportResult,
	TelemetryValue,
} from '~~/shared/contracts/telemetry'
import type { PageResult } from '~~/shared/contracts/api'

const telemetryValueSchema = z.union([z.number(), z.boolean(), z.string()])

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
		public readonly code: string,
		message: string,
	) {
		super(message)
		this.name = 'TelemetryError'
	}
}

export async function reportTelemetry(raw: unknown): Promise<TelemetryReportResult> {
	const input = reportInputSchema.parse(raw) as TelemetryReportInput
	const prisma = usePrisma()

	const device = await prisma.device.findUnique({
		where: { deviceCode: input.deviceCode },
		select: { id: true, deviceCode: true, productId: true, status: true, deletedAt: true },
	})

	if (!device || device.deletedAt) {
		throw new TelemetryError('DEVICE_NOT_FOUND', `设备 ${input.deviceCode} 不存在`)
	}
	if (device.status !== 'ENABLED') {
		throw new TelemetryError('DEVICE_DISABLED', `设备 ${input.deviceCode} 已停用`)
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

	if (Object.keys(acceptedProps).length === 0) {
		throw new TelemetryError(
			'NO_VALID_PROPERTIES',
			`没有合法属性，拒绝原因: ${rejectedProps.join(', ')}`,
		)
	}

	const reportedAt = new Date(input.reportedAt)

	const report = await prisma.$transaction(async (tx) => {
		const created = await tx.telemetryReport.create({
			data: {
				deviceId: device.id,
				reportedAt,
				rawJson: input.props as unknown as Prisma.InputJsonValue,
			},
		})

		await tx.telemetryValue.createMany({
			data: Object.entries(acceptedProps).map(([identifier, value]) => ({
				reportId: created.id,
				propertyIdentifier: identifier,
				valueNumber: typeof value === 'number' ? value : null,
				valueBoolean: typeof value === 'boolean' ? value : null,
				valueText: typeof value === 'string' ? value : null,
			})),
		})

		return created
	})

	await eventBus.emit('telemetry.reported', {
		reportId: String(report.id),
		deviceId: String(device.id),
		deviceCode: device.deviceCode,
		reportedAt: input.reportedAt,
		props: acceptedProps,
	})

	const alarmTriggered = THRESHOLD_CHECKS.some(({ identifier, threshold }) => {
		const value = acceptedProps[identifier]
		return typeof value === 'number' && value > threshold
	})

	return {
		reportId: String(report.id),
		acceptedPropertyCount: Object.keys(acceptedProps).length,
		alarmTriggered,
	}
}

export const historyQuerySchema = z.object({
	deviceIds: z.string().min(1),
	propertyIdentifier: z.string().min(1),
	start: z.string().datetime({ offset: true }),
	end: z.string().datetime({ offset: true }),
})

export async function queryHistory(raw: unknown): Promise<TelemetryPoint[]> {
	const input = historyQuerySchema.parse(raw)
	const prisma = usePrisma()
	const ids = input.deviceIds
		.split(',')
		.map((s) => Number(s.trim()))
		.filter((n) => Number.isFinite(n))

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
			v.valueNumber !== null
				? Number(v.valueNumber)
				: v.valueBoolean !== null
					? v.valueBoolean
					: (v.valueText ?? '')
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
	deviceId: z.coerce.number().int().positive().optional(),
})

export async function queryAlarms(raw: unknown): Promise<PageResult<AlarmSummary>> {
	const input = alarmQuerySchema.parse(raw)
	const prisma = usePrisma()

	if (input.deviceId) {
		const device = await prisma.device.findUnique({
			where: { id: input.deviceId },
			select: { id: true },
		})
		if (!device) {
			return { items: [], page: input.page, pageSize: input.pageSize, total: 0 }
		}
	}

	const where: Prisma.AlarmWhereInput = {}
	if (input.status) where.status = input.status
	if (input.level) where.level = input.level
	if (input.deviceId) where.deviceId = input.deviceId

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

export const alarmStatusSchema = z.object({
	status: z.enum(['ACKNOWLEDGED', 'RECOVERED', 'IGNORED']),
})

export async function updateAlarmStatus(
	alarmId: string,
	raw: unknown,
): Promise<{ alarmId: string; previousStatus: AlarmStatus; status: AlarmStatus }> {
	const input = alarmStatusSchema.parse(raw)
	const prisma = usePrisma()
	const id = Number(alarmId)
	if (Number.isNaN(id)) throw new TelemetryError('ALARM_NOT_FOUND', `报警 ${alarmId} 不存在`)

	const alarm = await prisma.alarm.findUnique({ where: { id } })
	if (!alarm) throw new TelemetryError('ALARM_NOT_FOUND', `报警 ${alarmId} 不存在`)

	const previousStatus = alarm.status
	const now = new Date()
	await prisma.alarm.update({
		where: { id },
		data: { status: input.status, handledAt: now },
	})

	await eventBus.emit('alarm.status.changed', {
		alarmId: String(id),
		previousStatus,
		status: input.status,
		handledAt: now.toISOString(),
	})

	return { alarmId: String(id), previousStatus, status: input.status }
}
