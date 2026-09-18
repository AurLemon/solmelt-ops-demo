import type { PageResult } from '~~/shared/contracts/api'
import type {
	DeviceLatestValue,
	DeviceStatus,
	DeviceSummary,
	ProductPropertyDefinition,
	ProductSummary,
} from '~~/shared/contracts/device'
import type { DeviceCreatedEvent, DeviceStatusChangedEvent } from '~~/shared/events'
import { MOLTEN_SALT_PUMP_PRODUCT } from '~~/shared/domain/product'
import { eventBus } from '~~/server/core/event-bus'
import { usePrisma } from '~~/server/core/prisma'
import type { Device, Prisma } from '../../../../generated/prisma/client'
import { ServiceError } from './api-support'
import { CANONICAL_PROPERTIES, DEVICE_CATALOG } from './device-catalog'

/** 在线窗口固定为 300 秒（冻结口径）。 */
const ONLINE_WINDOW_MS = 300_000

export interface DeviceListFilter {
	page: number
	pageSize: number
	keyword?: string
	status?: DeviceStatus
	productId?: number
}

export interface DeviceModelPayload {
	productKey: string
	productName: string
	properties: Array<{
		identifier: string
		name: string
		dataType: 'BOOL' | 'DOUBLE'
		unit: string
		category: string
	}>
}

export interface CreateProductData {
	identifier: string
	name: string
	remark?: string
}

function isRecentlyReported(lastReportedAt: Date | null, now: number): boolean {
	return lastReportedAt !== null && now - lastReportedAt.getTime() <= ONLINE_WINDOW_MS
}

function toDeviceSummary(device: Device): DeviceSummary {
	return {
		id: String(device.id),
		deviceCode: device.deviceCode,
		name: device.name,
		pumpType: device.pumpType,
		status: device.status,
		lastReportedAt: device.lastReportedAt ? device.lastReportedAt.toISOString() : null,
		online: isRecentlyReported(device.lastReportedAt, Date.now()),
	}
}

async function findExistingDevice(id: number): Promise<Device> {
	const device = await usePrisma().device.findFirst({ where: { id, deletedAt: null } })
	if (!device) {
		throw new ServiceError(404, 'NOT_FOUND', '设备不存在或已删除')
	}
	return device
}

export async function listProducts(): Promise<ProductSummary[]> {
	const products = await usePrisma().product.findMany({ orderBy: { id: 'asc' } })
	return products.map((product) => ({
		id: String(product.id),
		identifier: product.identifier,
		name: product.name,
		remark: product.remark,
	}))
}

export async function createProduct(input: CreateProductData): Promise<ProductSummary> {
	if (
		input.identifier !== MOLTEN_SALT_PUMP_PRODUCT.identifier ||
		input.name !== MOLTEN_SALT_PUMP_PRODUCT.name
	) {
		throw new ServiceError(400, 'VALIDATION_ERROR', '当前仅支持创建立式熔盐泵产品')
	}

	const prisma = usePrisma()
	const existing = await prisma.product.findUnique({ where: { identifier: input.identifier } })
	if (existing) {
		throw new ServiceError(409, 'CONFLICT', '产品标识已存在')
	}

	const created = await prisma.product.create({
		data: {
			identifier: input.identifier,
			name: input.name,
			...(input.remark !== undefined ? { remark: input.remark } : {}),
		},
	})
	return {
		id: String(created.id),
		identifier: created.identifier,
		name: created.name,
		remark: created.remark,
	}
}

export async function listProductProperties(
	productId: number,
): Promise<ProductPropertyDefinition[]> {
	const prisma = usePrisma()
	const product = await prisma.product.findUnique({ where: { id: productId } })
	if (!product) {
		throw new ServiceError(404, 'NOT_FOUND', '产品不存在')
	}

	const properties = await prisma.productProperty.findMany({
		where: { productId },
		orderBy: [{ sort: 'asc' }, { id: 'asc' }],
	})
	return properties.map((property) => ({
		identifier: property.identifier,
		name: property.name,
		dataType: property.dataType,
		unit: property.unit,
		category: property.category,
		sort: property.sort,
	}))
}

export async function importProductProperties(
	productId: number,
	payload: DeviceModelPayload,
): Promise<{ productId: string; importedPropertyCount: number }> {
	const prisma = usePrisma()
	const product = await prisma.product.findUnique({ where: { id: productId } })
	if (!product) {
		throw new ServiceError(404, 'NOT_FOUND', '产品不存在')
	}
	if (
		payload.productKey !== MOLTEN_SALT_PUMP_PRODUCT.identifier ||
		payload.productName !== MOLTEN_SALT_PUMP_PRODUCT.name
	) {
		throw new ServiceError(400, 'VALIDATION_ERROR', '物模型文件的产品标识或名称与立式熔盐泵不符')
	}
	if (payload.properties.length !== MOLTEN_SALT_PUMP_PRODUCT.expectedPropertyCount) {
		throw new ServiceError(
			400,
			'VALIDATION_ERROR',
			`物模型属性数量应为 ${MOLTEN_SALT_PUMP_PRODUCT.expectedPropertyCount} 个`,
		)
	}

	const canonicalByIdentifier = new Map(CANONICAL_PROPERTIES.map((item) => [item.identifier, item]))
	const seen = new Set<string>()
	for (const property of payload.properties) {
		if (seen.has(property.identifier)) {
			throw new ServiceError(400, 'VALIDATION_ERROR', `物模型属性 ${property.identifier} 重复`)
		}
		seen.add(property.identifier)
		const canonical = canonicalByIdentifier.get(property.identifier)
		if (
			!canonical ||
			canonical.dataType !== property.dataType ||
			canonical.unit !== property.unit
		) {
			throw new ServiceError(
				400,
				'VALIDATION_ERROR',
				`物模型属性 ${property.identifier} 与规范定义不一致`,
			)
		}
	}

	// 重复导入幂等：update 留空，不新增、不删除、不覆盖既有定义。
	await prisma.$transaction(async (tx) => {
		for (const [index, property] of payload.properties.entries()) {
			await tx.productProperty.upsert({
				where: { productId_identifier: { productId, identifier: property.identifier } },
				update: {},
				create: {
					productId,
					identifier: property.identifier,
					name: property.name,
					dataType: property.dataType,
					unit: property.unit,
					category: property.category,
					sort: index,
				},
			})
		}
	})

	return { productId: String(product.id), importedPropertyCount: payload.properties.length }
}

export async function listDevices(filter: DeviceListFilter): Promise<PageResult<DeviceSummary>> {
	const prisma = usePrisma()
	const where: Prisma.DeviceWhereInput = { deletedAt: null }
	if (filter.status !== undefined) {
		where.status = filter.status
	}
	if (filter.productId !== undefined) {
		where.productId = filter.productId
	}
	if (filter.keyword) {
		where.OR = [
			{ deviceCode: { contains: filter.keyword } },
			{ name: { contains: filter.keyword } },
		]
	}

	const [total, devices] = await Promise.all([
		prisma.device.count({ where }),
		prisma.device.findMany({
			where,
			orderBy: { deviceCode: 'asc' },
			skip: (filter.page - 1) * filter.pageSize,
			take: filter.pageSize,
		}),
	])
	return {
		items: devices.map(toDeviceSummary),
		page: filter.page,
		pageSize: filter.pageSize,
		total,
	}
}

export async function getDevice(id: number): Promise<DeviceSummary> {
	return toDeviceSummary(await findExistingDevice(id))
}

export async function createDevice(input: {
	productId: number
	deviceCode: string
	name: string
	pumpType: 'COLD_SALT' | 'TEMPERING' | 'HOT_SALT'
	status: DeviceStatus
}): Promise<DeviceSummary> {
	const prisma = usePrisma()
	const product = await prisma.product.findUnique({ where: { id: input.productId } })
	if (!product) {
		throw new ServiceError(404, 'NOT_FOUND', '目标产品不存在')
	}

	const catalogDevice = DEVICE_CATALOG.find((item) => item.deviceCode === input.deviceCode)
	if (!catalogDevice) {
		throw new ServiceError(400, 'VALIDATION_ERROR', '设备编号必须来自老师物模型目录')
	}
	if (catalogDevice.name !== input.name || catalogDevice.pumpType !== input.pumpType) {
		throw new ServiceError(400, 'VALIDATION_ERROR', '设备名称或泵型与物模型目录不一致')
	}

	const existing = await prisma.device.findUnique({ where: { deviceCode: input.deviceCode } })
	if (existing) {
		throw new ServiceError(409, 'CONFLICT', '设备编号已存在')
	}

	const created = await prisma.device.create({
		data: {
			productId: input.productId,
			deviceCode: input.deviceCode,
			name: input.name,
			pumpType: input.pumpType,
			status: input.status,
		},
	})
	const summary = toDeviceSummary(created)
	const event: DeviceCreatedEvent = {
		deviceId: summary.id,
		deviceCode: created.deviceCode,
		occurredAt: new Date().toISOString(),
	}
	await eventBus.emit('device.created', event)
	return summary
}

export async function updateDevice(
	id: number,
	input: { name: string; pumpType: 'COLD_SALT' | 'TEMPERING' | 'HOT_SALT'; status: DeviceStatus },
): Promise<DeviceSummary> {
	const device = await findExistingDevice(id)
	const updated = await usePrisma().device.update({
		where: { id },
		data: { name: input.name, pumpType: input.pumpType, status: input.status },
	})

	if (device.status !== updated.status) {
		const event: DeviceStatusChangedEvent = {
			deviceId: String(updated.id),
			deviceCode: updated.deviceCode,
			previousStatus: device.status,
			status: updated.status,
			occurredAt: new Date().toISOString(),
		}
		await eventBus.emit('device.status.changed', event)
	}
	return toDeviceSummary(updated)
}

export async function deleteDevice(id: number): Promise<{ id: string }> {
	const device = await findExistingDevice(id)
	await usePrisma().device.update({ where: { id }, data: { deletedAt: new Date() } })
	return { id: String(device.id) }
}

export async function getDeviceLatestValues(id: number): Promise<DeviceLatestValue[]> {
	const device = await findExistingDevice(id)
	const rows = await usePrisma().deviceLatestValue.findMany({
		where: { deviceId: device.id },
		orderBy: [{ propertyIdentifier: 'asc' }],
	})
	return rows.flatMap((row) => {
		// DeviceLatestValue 是 Telemetry 拥有的冻结投影，此处只读；BOOL/DOUBLE 之外不应出现。
		const value =
			row.valueBoolean !== null
				? row.valueBoolean
				: row.valueNumber !== null
					? row.valueNumber.toNumber()
					: null
		if (value === null) {
			return []
		}
		return [
			{
				propertyIdentifier: row.propertyIdentifier,
				value,
				reportedAt: row.reportedAt.toISOString(),
			},
		]
	})
}

export async function getDeviceOnline(id: number): Promise<{
	online: boolean
	lastReportedAt: string | null
}> {
	const device = await findExistingDevice(id)
	return {
		online: isRecentlyReported(device.lastReportedAt, Date.now()),
		lastReportedAt: device.lastReportedAt ? device.lastReportedAt.toISOString() : null,
	}
}
