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

export interface ProductSummary {
	id: string
	identifier: string
	name: string
	remark: string | null
}

export interface ProductDefinition extends ProductSummary {
	properties: ProductPropertyDefinition[]
}

export interface CreateProductInput {
	identifier: string
	name: string
	remark?: string
}

export interface ProductImportResult {
	productId: string
	importedPropertyCount: number
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

export interface CreateDeviceInput {
	productId: string
	deviceCode: string
	name: string
	pumpType: PumpType
	status: DeviceStatus
}

export interface UpdateDeviceInput {
	name: string
	pumpType: PumpType
	status: DeviceStatus
}

export interface DeviceListQuery {
	page?: number
	pageSize?: number
	keyword?: string
	status?: DeviceStatus
	productId?: string
}

export interface DeviceLatestValue {
	propertyIdentifier: string
	value: number | boolean
	reportedAt: string
}
