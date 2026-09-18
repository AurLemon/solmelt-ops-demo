import type {
	DashboardOverview,
	DashboardRealtimeDevice,
	PumpTypeCount,
} from '~~/shared/contracts/dashboard'
import type { AlarmSummary } from '~~/shared/contracts/telemetry'
import { DOMAIN_THRESHOLDS } from '~~/shared/domain/thresholds'
import { usePrisma } from '~~/server/core/prisma'

/**
 * 冻结口径（docs/domain-glossary.md）：
 * 在线 = 未删除且最近 300 秒内存在成功上报；数据延迟 = 最新成功上报距今超过 60 秒。
 */
const ONLINE_WINDOW_MS = DOMAIN_THRESHOLDS.onlineWindowSeconds * 1_000
const DATA_DELAY_MS = DOMAIN_THRESHOLDS.dataDelaySeconds * 1_000

/** 判定「运行中」依据的物模型属性：变频器启动状态。 */
const INVERTER_START_STATUS = 'inverter_start_status'

/** Asia/Shanghai 全年固定 UTC+8，无夏令时。 */
const ASIA_SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1_000

const PUMP_TYPE_ORDER: readonly PumpTypeCount['type'][] = ['COLD_SALT', 'TEMPERING', 'HOT_SALT']

/** 「今天 00:00（Asia/Shanghai）」对应的 UTC 时刻，自然日按北京时间切分。 */
function startOfTodayInShanghai(now: Date): Date {
	const shifted = new Date(now.getTime() + ASIA_SHANGHAI_OFFSET_MS)
	shifted.setUTCHours(0, 0, 0, 0)
	return new Date(shifted.getTime() - ASIA_SHANGHAI_OFFSET_MS)
}

/** 最新值行 → 契约允许的标量（物模型属性只有 BOOL / DOUBLE）；没有值的属性不进入 metrics。 */
function toMetricValue(row: {
	valueNumber: unknown
	valueBoolean: boolean | null
}): number | boolean | undefined {
	if (row.valueNumber !== null && row.valueNumber !== undefined) {
		const value = Number(row.valueNumber)
		if (Number.isFinite(value)) return value
	}
	if (row.valueBoolean !== null && row.valueBoolean !== undefined) return row.valueBoolean
	return undefined
}

/** 概览：六张统计卡的真实聚合 + 全局数据截至时间。 */
export async function getDashboardOverview(now: Date = new Date()): Promise<DashboardOverview> {
	const prisma = usePrisma()
	const onlineSince = new Date(now.getTime() - ONLINE_WINDOW_MS)
	const todayStart = startOfTodayInShanghai(now)

	const [
		deviceTotal,
		onlineCount,
		runningCount,
		todayAlarmCount,
		unhandledAlarmCount,
		pumpTotals,
		pumpRunningTotals,
		latestReport,
	] = await Promise.all([
		prisma.device.count({ where: { deletedAt: null } }),
		prisma.device.count({ where: { deletedAt: null, lastReportedAt: { gte: onlineSince } } }),
		prisma.device.count({
			where: {
				deletedAt: null,
				lastReportedAt: { gte: onlineSince },
				latestValues: {
					some: { propertyIdentifier: INVERTER_START_STATUS, valueBoolean: true },
				},
			},
		}),
		prisma.alarm.count({ where: { occurredAt: { gte: todayStart } } }),
		prisma.alarm.count({ where: { status: 'UNHANDLED' } }),
		prisma.device.groupBy({
			by: ['pumpType'],
			where: { deletedAt: null },
			_count: { _all: true },
		}),
		prisma.device.groupBy({
			by: ['pumpType'],
			where: {
				deletedAt: null,
				lastReportedAt: { gte: onlineSince },
				latestValues: {
					some: { propertyIdentifier: INVERTER_START_STATUS, valueBoolean: true },
				},
			},
			_count: { _all: true },
		}),
		prisma.device.aggregate({ where: { deletedAt: null }, _max: { lastReportedAt: true } }),
	])

	const totalByType = new Map<string, number>()
	for (const row of pumpTotals) totalByType.set(row.pumpType, row._count._all)

	const runningByType = new Map<string, number>()
	for (const row of pumpRunningTotals) runningByType.set(row.pumpType, row._count._all)

	const pumpTypes: PumpTypeCount[] = PUMP_TYPE_ORDER.map((type) => ({
		type,
		total: totalByType.get(type) ?? 0,
		running: runningByType.get(type) ?? 0,
	}))

	const maxReportedAt = latestReport._max.lastReportedAt

	return {
		deviceTotal,
		onlineCount,
		offlineCount: deviceTotal - onlineCount,
		runningCount,
		todayAlarmCount,
		unhandledAlarmCount,
		pumpTypes,
		dataUntil: maxReportedAt === null ? null : maxReportedAt.toISOString(),
	}
}

/** 设备实时状态：9 台设备的只读投影与在线/运行中/延迟判定。 */
export async function listRealtimeDevices(
	now: Date = new Date(),
): Promise<DashboardRealtimeDevice[]> {
	const prisma = usePrisma()
	const nowMs = now.getTime()
	const onlineSinceMs = nowMs - ONLINE_WINDOW_MS

	const devices = await prisma.device.findMany({
		where: { deletedAt: null },
		orderBy: { deviceCode: 'asc' },
		select: {
			id: true,
			deviceCode: true,
			name: true,
			lastReportedAt: true,
			latestValues: {
				select: {
					propertyIdentifier: true,
					valueNumber: true,
					valueBoolean: true,
				},
			},
		},
	})

	return devices.map((device) => {
		const metrics: Record<string, number | boolean> = {}
		for (const row of device.latestValues) {
			const value = toMetricValue(row)
			if (value !== undefined) metrics[row.propertyIdentifier] = value
		}

		const lastReportedAt = device.lastReportedAt
		const online = lastReportedAt !== null && lastReportedAt.getTime() >= onlineSinceMs
		/** 从未上报时 lastReportedAt 为 null：那是空态，不能标成延迟。 */
		const delayed = lastReportedAt !== null && nowMs - lastReportedAt.getTime() > DATA_DELAY_MS

		return {
			deviceId: String(device.id),
			deviceCode: device.deviceCode,
			name: device.name,
			online,
			running: online && metrics[INVERTER_START_STATUS] === true,
			delayed,
			latestReportedAt: lastReportedAt === null ? null : lastReportedAt.toISOString(),
			metrics,
		}
	})
}

const ALARM_SELECTION = {
	id: true,
	deviceId: true,
	metric: true,
	threshold: true,
	actualValue: true,
	level: true,
	status: true,
	occurredAt: true,
	handledAt: true,
	device: { select: { deviceCode: true } },
} as const

interface AlarmRow {
	id: number
	deviceId: number
	metric: string
	threshold: unknown
	actualValue: unknown
	level: AlarmSummary['level']
	status: AlarmSummary['status']
	occurredAt: Date
	handledAt: Date | null
	device: { deviceCode: string }
}

function toAlarmSummary(row: AlarmRow): AlarmSummary {
	return {
		id: String(row.id),
		deviceId: String(row.deviceId),
		deviceCode: row.device.deviceCode,
		metric: row.metric,
		threshold: Number(row.threshold),
		actualValue: Number(row.actualValue),
		level: row.level,
		status: row.status,
		occurredAt: row.occurredAt.toISOString(),
		handledAt: row.handledAt === null ? null : row.handledAt.toISOString(),
	}
}

/** 近期报警：UNHANDLED 优先，不足时再按 occurredAt 倒序补齐。 */
export async function listRecentAlarms(limit: number): Promise<AlarmSummary[]> {
	const prisma = usePrisma()

	const unhandled = await prisma.alarm.findMany({
		where: { status: 'UNHANDLED' },
		orderBy: { occurredAt: 'desc' },
		take: limit,
		select: ALARM_SELECTION,
	})

	const remaining = limit - unhandled.length
	const settled =
		remaining > 0
			? await prisma.alarm.findMany({
					where: { status: { not: 'UNHANDLED' } },
					orderBy: { occurredAt: 'desc' },
					take: remaining,
					select: ALARM_SELECTION,
				})
			: []

	const rows: AlarmRow[] = [...unhandled, ...settled]
	return rows.map(toAlarmSummary)
}
