import type { DeviceStatus } from './contracts/device'
import type { AlarmLevel, TelemetryValue } from './contracts/telemetry'

export interface DeviceCreatedEvent {
	deviceId: string
	deviceCode: string
	occurredAt: string
}

export interface DeviceStatusChangedEvent {
	deviceId: string
	deviceCode: string
	previousStatus: DeviceStatus
	status: DeviceStatus
	occurredAt: string
}

export interface TelemetryReportedEvent {
	reportId: string
	deviceId: string
	deviceCode: string
	reportedAt: string
	props: Record<string, TelemetryValue>
}

export interface AlarmCreatedEvent {
	alarmId: string
	deviceId: string
	metric: string
	level: AlarmLevel
	occurredAt: string
}

export interface DomainEventMap {
	'device.created': DeviceCreatedEvent
	'device.status.changed': DeviceStatusChangedEvent
	'telemetry.reported': TelemetryReportedEvent
	'alarm.created': AlarmCreatedEvent
}

export type DomainEventName = keyof DomainEventMap
