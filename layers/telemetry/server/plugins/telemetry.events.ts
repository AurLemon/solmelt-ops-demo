import { eventBus } from '~~/server/core/event-bus'
import { usePrisma } from '~~/server/core/prisma'
import { DOMAIN_THRESHOLDS } from '~~/shared/domain/thresholds'
import type { TelemetryReportedEvent } from '~~/shared/events'
import type { TelemetryValue } from '~~/shared/contracts/telemetry'

const THRESHOLD_RULES: Array<{
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

function mapValueFields(value: TelemetryValue) {
	return {
		valueNumber: typeof value === 'number' ? value : null,
		valueBoolean: typeof value === 'boolean' ? value : null,
		valueText: typeof value === 'string' ? value : null,
	}
}

async function handleTelemetryReported(payload: TelemetryReportedEvent): Promise<void> {
	const prisma = usePrisma()
	const deviceId = Number(payload.deviceId)
	const reportedAt = new Date(payload.reportedAt)

	for (const [identifier, value] of Object.entries(payload.props)) {
		await prisma.deviceLatestValue.upsert({
			where: { deviceId_propertyIdentifier: { deviceId, propertyIdentifier: identifier } },
			update: { ...mapValueFields(value), reportedAt },
			create: { deviceId, propertyIdentifier: identifier, ...mapValueFields(value), reportedAt },
		})
	}

	for (const { identifier, threshold } of THRESHOLD_RULES) {
		const value = payload.props[identifier]
		if (typeof value !== 'number' || value <= threshold) continue

		const alarm = await prisma.alarm.create({
			data: {
				deviceId,
				metric: identifier,
				threshold,
				actualValue: value,
				level: 'WARNING',
				status: 'UNHANDLED',
				occurredAt: reportedAt,
			},
		})

		await eventBus.emit('alarm.created', {
			alarmId: String(alarm.id),
			deviceId: payload.deviceId,
			metric: identifier,
			level: alarm.level,
			occurredAt: payload.reportedAt,
		})
	}
}

export default defineNitroPlugin(() => {
	eventBus.on('telemetry.reported', handleTelemetryReported)
})
