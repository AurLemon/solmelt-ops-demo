import type { TelemetryPoint, AlarmSummary, AlarmStatus } from '~~/shared/contracts/telemetry'
import type { PageResult, ApiResult } from '~~/shared/contracts/api'

/** 9 台老师设备（来自 seed 数据，ID 1-9 对应 deviceCode 升序） */
export interface DeviceOption {
	deviceId: string
	deviceCode: string
	name: string
}

export const DEVICE_OPTIONS: readonly DeviceOption[] = [
	{ deviceId: '1', deviceCode: '20WSC10AP010', name: '1号冷盐泵' },
	{ deviceId: '2', deviceCode: '20WSC10AP020', name: '2号冷盐泵' },
	{ deviceId: '3', deviceCode: '20WSC10AP030', name: '3号冷盐泵' },
	{ deviceId: '4', deviceCode: '20WSC10AP040', name: '4号冷盐泵' },
	{ deviceId: '5', deviceCode: '20WSC10AP050', name: '1号调温泵' },
	{ deviceId: '6', deviceCode: '20WSC10AP060', name: '2号调温泵' },
	{ deviceId: '7', deviceCode: '20WSH20AP010', name: '1号热盐泵' },
	{ deviceId: '8', deviceCode: '20WSH20AP020', name: '2号热盐泵' },
	{ deviceId: '9', deviceCode: '20WSH20AP030', name: '3号热盐泵' },
]

/** 30 个物模型属性（来自 seed 数据与 .requirements/学生复现-物模型/） */
export interface PropertyOption {
	identifier: string
	name: string
	dataType: 'BOOL' | 'DOUBLE'
	unit: string
	category: string
}

export const PROPERTY_OPTIONS: readonly PropertyOption[] = [
	{
		identifier: 'inverter_start_status',
		name: '变频器启动状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'inverter_stop_status',
		name: '变频器停止状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'inverter_alarm_status',
		name: '变频器报警状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'inverter_fault_status',
		name: '变频器故障状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'inverter_ready_status',
		name: '变频器就绪状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'inverter_emergency_stop_status',
		name: '变频器急停状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'inverter_remote_control_status',
		name: '变频器远程控制状态',
		dataType: 'BOOL',
		unit: '',
		category: '状态',
	},
	{
		identifier: 'speed_command',
		name: '转速指令',
		dataType: 'DOUBLE',
		unit: 'rpm',
		category: '转速',
	},
	{
		identifier: 'speed_feedback',
		name: '转速反馈',
		dataType: 'DOUBLE',
		unit: 'rpm',
		category: '转速',
	},
	{
		identifier: 'forward_speed',
		name: '正转转速',
		dataType: 'DOUBLE',
		unit: 'rpm',
		category: '转速',
	},
	{
		identifier: 'inverter_current',
		name: '变频器电流',
		dataType: 'DOUBLE',
		unit: 'A',
		category: '电气',
	},
	{
		identifier: 'electric_meter_reading',
		name: '电表表盘数',
		dataType: 'DOUBLE',
		unit: 'kWh',
		category: '电气',
	},
	{
		identifier: 'feeder_current',
		name: '馈线电流',
		dataType: 'DOUBLE',
		unit: 'A',
		category: '电气',
	},
	{
		identifier: 'motor_temp_u1',
		name: '电机U相定子线圈温度1',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_temp_u2',
		name: '电机U相定子线圈温度2',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_temp_v1',
		name: '电机V相定子线圈温度1',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_temp_v2',
		name: '电机V相定子线圈温度2',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_temp_w1',
		name: '电机W相定子线圈温度1',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_temp_w2',
		name: '电机W相定子线圈温度2',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_drive_bearing_temp',
		name: '电机驱动端轴承温度',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_non_drive_bearing_temp',
		name: '电机非驱动端轴承温度',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'thrust_bearing_temp_x',
		name: '推力轴承温度X',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'thrust_bearing_temp_y',
		name: '推力轴承温度Y',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'pump_casing_temp1',
		name: '泵壳体温度1',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'pump_casing_temp2',
		name: '泵壳体温度2',
		dataType: 'DOUBLE',
		unit: '℃',
		category: '温度',
	},
	{
		identifier: 'motor_vibration_x',
		name: '电机振动X轴',
		dataType: 'DOUBLE',
		unit: 'mm/s',
		category: '振动',
	},
	{
		identifier: 'motor_vibration_y',
		name: '电机振动Y轴',
		dataType: 'DOUBLE',
		unit: 'mm/s',
		category: '振动',
	},
	{
		identifier: 'motor_vibration_z',
		name: '电机振动Z轴',
		dataType: 'DOUBLE',
		unit: 'mm/s',
		category: '振动',
	},
	{
		identifier: 'pump_vibration_x',
		name: '泵振动X轴',
		dataType: 'DOUBLE',
		unit: 'mm/s',
		category: '振动',
	},
	{
		identifier: 'pump_vibration_y',
		name: '泵振动Y轴',
		dataType: 'DOUBLE',
		unit: 'mm/s',
		category: '振动',
	},
]

/** 属性按 category 分组，供下拉选择使用 */
export const PROPERTY_GROUPS: readonly { category: string; items: PropertyOption[] }[] = (() => {
	const map = new Map<string, PropertyOption[]>()
	for (const p of PROPERTY_OPTIONS) {
		const list = map.get(p.category) ?? []
		list.push(p)
		map.set(p.category, list)
	}
	return [...map.entries()].map(([category, items]) => ({ category, items }))
})()

/** 报警级别选项 */
export const ALARM_LEVEL_OPTIONS = [
	{ label: '全部', value: '' },
	{ label: '预警 (WARNING)', value: 'WARNING' },
	{ label: '严重 (SERIOUS)', value: 'SERIOUS' },
] as const

/** 报警状态选项 */
export const ALARM_STATUS_OPTIONS = [
	{ label: '全部', value: '' },
	{ label: '未处理', value: 'UNHANDLED' },
	{ label: '已确认', value: 'ACKNOWLEDGED' },
	{ label: '已恢复', value: 'RECOVERED' },
	{ label: '已忽略', value: 'IGNORED' },
] as const

/** 状态变更操作（PUT 接口为保留扩展项） */
export const ALARM_STATUS_ACTIONS: { label: string; value: AlarmStatus; color: string }[] = [
	{ label: '确认', value: 'ACKNOWLEDGED', color: 'amber' },
	{ label: '恢复', value: 'RECOVERED', color: 'green' },
	{ label: '忽略', value: 'IGNORED', color: 'slate' },
]

/** UTC ISO 8601 → 北京时间显示字符串 */
export function formatBeijingTime(iso: string): string {
	const d = new Date(iso)
	const parts = new Intl.DateTimeFormat('zh-CN', {
		timeZone: 'Asia/Shanghai',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).formatToParts(d)
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
	return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

/** 当前 UTC ISO 字符串 */
export function nowIso(): string {
	return new Date().toISOString()
}

/** 偏移指定分钟前的 UTC ISO 字符串 */
export function isoMinusMinutes(minutes: number): string {
	return new Date(Date.now() - minutes * 60_000).toISOString()
}

/** ISO → datetime-local 输入值（北京时间） */
export function toLocalInput(iso: string): string {
	const d = new Date(iso)
	const beijing = new Date(d.getTime() + 8 * 60 * 60_000)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${beijing.getFullYear()}-${pad(beijing.getMonth() + 1)}-${pad(beijing.getDate())}T${pad(beijing.getHours())}:${pad(beijing.getMinutes())}`
}

/** datetime-local 输入值（北京时间）→ UTC ISO */
export function fromLocalInput(local: string): string {
	if (!local) return ''
	// 输入视为北京时间（UTC+8），转换为 UTC ISO
	const beijingDate = new Date(local)
	const utc = new Date(beijingDate.getTime() - 8 * 60 * 60_000)
	return utc.toISOString()
}

/** 根据 identifier 查找属性选项 */
export function findProperty(identifier: string): PropertyOption | undefined {
	return PROPERTY_OPTIONS.find((p) => p.identifier === identifier)
}

/** 根据 deviceId 查找设备选项 */
export function findDevice(deviceId: string): DeviceOption | undefined {
	return DEVICE_OPTIONS.find((d) => d.deviceId === deviceId)
}

// ── API 封装 ──────────────────────────────────────────────

/** 统一解包 ApiResult<T>，失败时抛出 Error（含 ofetch 非 2xx 响应体解包） */
async function unwrapApi<T>(promise: Promise<ApiResult<T>>): Promise<T> {
	try {
		const result = await promise
		if (result.success) return result.data
		throw new Error(result.error.message)
	} catch (err: unknown) {
		// ofetch 的 FetchError 将响应体放在 .data 中
		const data = (err as { data?: { error?: { message?: string } } }).data
		if (data?.error?.message) throw new Error(data.error.message, { cause: err })
		if (err instanceof Error) throw err
		throw new Error('请求失败', { cause: err })
	}
}

export async function fetchHistory(params: {
	deviceIds: string[]
	propertyIdentifier: string
	start: string
	end: string
}): Promise<TelemetryPoint[]> {
	const query = {
		deviceIds: params.deviceIds.join(','),
		propertyIdentifier: params.propertyIdentifier,
		start: params.start,
		end: params.end,
	}
	return unwrapApi($fetch<ApiResult<TelemetryPoint[]>>('/api/v1/telemetry/history', { query }))
}

export async function fetchAlarms(params: {
	page: number
	pageSize: number
	deviceId?: string
	level?: string
	status?: string
}): Promise<PageResult<AlarmSummary>> {
	const query: Record<string, string | number> = {
		page: params.page,
		pageSize: params.pageSize,
	}
	if (params.deviceId) query.deviceId = params.deviceId
	if (params.level) query.level = params.level
	if (params.status) query.status = params.status
	return unwrapApi(
		$fetch<ApiResult<PageResult<AlarmSummary>>>('/api/v1/telemetry/alarms', { query }),
	)
}

export async function patchAlarmStatus(
	alarmId: string,
	status: AlarmStatus,
): Promise<AlarmSummary> {
	return unwrapApi(
		$fetch<ApiResult<AlarmSummary>>(`/api/v1/telemetry/alarms/${alarmId}/status`, {
			method: 'PUT',
			body: { status },
		}),
	)
}
