export type TelemetryValue = number | boolean | string
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
