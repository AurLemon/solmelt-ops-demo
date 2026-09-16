import type { AlarmSummary } from './telemetry'

export interface PumpTypeCount {
	type: 'COLD_SALT' | 'TEMPERING' | 'HOT_SALT'
	running: number
	total: number
}

export interface DashboardOverview {
	deviceTotal: number
	onlineCount: number
	offlineCount: number
	runningCount: number
	todayAlarmCount: number
	unhandledAlarmCount: number
	pumpTypes: PumpTypeCount[]
	dataUntil: string | null
}

export interface DashboardRealtimeDevice {
	deviceId: string
	deviceCode: string
	name: string
	online: boolean
	running: boolean
	delayed: boolean
	latestReportedAt: string | null
	metrics: Record<string, number | boolean | string>
}

export interface DashboardSnapshot {
	overview: DashboardOverview
	devices: DashboardRealtimeDevice[]
	recentAlarms: AlarmSummary[]
}
