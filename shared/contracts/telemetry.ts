/** 老师物模型仅定义 BOOL 与 DOUBLE 两类属性。 */
export type TelemetryValue = number | boolean
/** 最低验收的三项阈值报警均为 WARNING；SERIOUS 保留给获批准的后续规则。 */
export type AlarmLevel = 'WARNING' | 'SERIOUS'
export type AlarmStatus = 'UNHANDLED' | 'ACKNOWLEDGED' | 'RECOVERED' | 'IGNORED'

export interface TelemetryReportInput {
	deviceCode: string
	reportedAt: string
	props: Record<string, TelemetryValue>
}

export interface TelemetryReportResult {
	reportId: string
	acceptedPropertyCount: number
	alarmTriggered: boolean
}

export interface TelemetryPoint {
	deviceId: string
	deviceCode: string
	propertyIdentifier: string
	value: TelemetryValue
	reportedAt: string
}

/** 曲线数据按 reportedAt 升序返回，不使用分页。 */
export interface TelemetryHistoryQuery {
	/** URL 查询中以英文逗号分隔，最多为九台老师设备。 */
	deviceIds: string[]
	propertyIdentifier: string
	start: string
	end: string
}

export interface AlarmListQuery {
	page?: number
	pageSize?: number
	deviceId?: string
	level?: AlarmLevel
	status?: AlarmStatus
}

export interface AlarmSummary {
	id: string
	deviceId: string
	deviceCode: string
	metric: string
	threshold: number
	actualValue: number
	level: AlarmLevel
	status: AlarmStatus
	occurredAt: string
	handledAt: string | null
}
