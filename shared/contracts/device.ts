export type PropertyDataType = 'BOOL' | 'DOUBLE'
export type PumpType = 'COLD_SALT' | 'TEMPERING' | 'HOT_SALT'
export type DeviceStatus = 'ENABLED' | 'DISABLED'

export interface ProductPropertyDefinition {
	identifier: string
	name: string
	dataType: PropertyDataType
	unit: string
	category: string
	sort: number
}

export interface ProductDefinition {
	id: string
	identifier: string
	name: string
	properties: ProductPropertyDefinition[]
}

export interface DeviceSummary {
	id: string
	deviceCode: string
	name: string
	pumpType: PumpType
	status: DeviceStatus
	lastReportedAt: string | null
	online: boolean
}

export interface DeviceLatestValue {
	propertyIdentifier: string
	value: number | boolean | string
	reportedAt: string
}
