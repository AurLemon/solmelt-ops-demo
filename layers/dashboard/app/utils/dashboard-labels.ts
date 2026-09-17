import type { PumpTypeCount } from '~~/shared/contracts/dashboard'
import type { AlarmLevel, AlarmStatus } from '~~/shared/contracts/telemetry'

/** 泵型中文名，取自 docs/domain-glossary.md 的冻结口径。 */
export const PUMP_TYPE_LABELS: Record<PumpTypeCount['type'], string> = {
	COLD_SALT: '冷盐泵',
	TEMPERING: '调温泵',
	HOT_SALT: '热盐泵',
}

/**
 * 大屏关心的关键指标，与 docs/domain-glossary.md 的三项报警阈值完全一致。
 * 这里只做展示顺序与中文名映射，数值一律来自真实上报，不在此处生成任何数据。
 */
export const KEY_METRICS = [
	'motor_drive_bearing_temp',
	'pump_vibration_x',
	'inverter_current',
] as const

/** 指标标识 → 展示名（物模型 property 的中文名）。 */
export const METRIC_LABELS: Record<string, string> = {
	inverter_start_status: '变频器启动状态',
	speed_command: '转速指令',
	speed_feedback: '转速反馈',
	inverter_current: '变频器电流',
	motor_drive_bearing_temp: '电机驱动端轴承温度',
	motor_non_drive_bearing_temp: '电机非驱动端轴承温度',
	pump_vibration_x: '泵振动X轴',
	pump_vibration_y: '泵振动Y轴',
	motor_vibration_x: '电机振动X轴',
}

/** 指标标识 → 单位（物模型 unit）。 */
export const METRIC_UNITS: Record<string, string> = {
	speed_command: 'rpm',
	speed_feedback: 'rpm',
	inverter_current: 'A',
	motor_drive_bearing_temp: '℃',
	motor_non_drive_bearing_temp: '℃',
	pump_vibration_x: 'mm/s',
	pump_vibration_y: 'mm/s',
	motor_vibration_x: 'mm/s',
}

export const ALARM_LEVEL_LABELS: Record<AlarmLevel, string> = {
	WARNING: '预警',
	SERIOUS: '严重报警',
}

export const ALARM_STATUS_LABELS: Record<AlarmStatus, string> = {
	UNHANDLED: '未处理',
	ACKNOWLEDGED: '已确认',
	RECOVERED: '已恢复',
	IGNORED: '已忽略',
}

export function metricLabel(identifier: string): string {
	return METRIC_LABELS[identifier] ?? identifier
}

export function metricUnit(identifier: string): string {
	return METRIC_UNITS[identifier] ?? ''
}

export function pumpTypeLabel(type: PumpTypeCount['type']): string {
	return PUMP_TYPE_LABELS[type] ?? type
}

const SHANGHAI_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
	timeZone: 'Asia/Shanghai',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
})

const SHANGHAI_CLOCK_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
	timeZone: 'Asia/Shanghai',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
})

function pick(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
	return parts.find((part) => part.type === type)?.value ?? ''
}

/** 所有接口传输 UTC ISO 8601，页面统一按 Asia/Shanghai 显示。 */
export function formatShanghaiTime(iso: string | null): string {
	if (!iso) return '—'
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return '—'
	const parts = SHANGHAI_FORMATTER.formatToParts(date)
	return `${pick(parts, 'month')}-${pick(parts, 'day')} ${pick(parts, 'hour')}:${pick(parts, 'minute')}:${pick(parts, 'second')}`
}

export function formatShanghaiClock(date: Date): string {
	const parts = SHANGHAI_CLOCK_FORMATTER.formatToParts(date)
	return `${pick(parts, 'year')}-${pick(parts, 'month')}-${pick(parts, 'day')} ${pick(parts, 'hour')}:${pick(parts, 'minute')}:${pick(parts, 'second')}`
}

/** 指标值 → 展示文本；没有真实值时显示占位符，绝不补零或编造。 */
export function formatMetricValue(value: number | boolean | undefined, identifier: string): string {
	if (value === undefined) return '—'
	if (typeof value === 'boolean') return value ? '是' : '否'
	const unit = metricUnit(identifier)
	return unit ? `${value} ${unit}` : String(value)
}
