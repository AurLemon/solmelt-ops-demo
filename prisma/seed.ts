import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { hash } from 'bcryptjs'
import {
	DeviceStatus,
	PrismaClient,
	PropertyDataType,
	PumpType,
	UserStatus,
} from '../generated/prisma/client'

interface SourceProperty {
	identifier: string
	name: string
	dataType: 'BOOL' | 'DOUBLE'
	unit: string
	category: string
}

interface SourceDeviceModel {
	deviceCode: string
	deviceName: string
	productKey: string
	productName: string
	properties: SourceProperty[]
}

const expectedProductKey = 'Z60KbveZzXk8'
const expectedDeviceCount = 9
const expectedPropertyCount = 30

function createPrismaClient(): PrismaClient {
	const adapter = new PrismaMariaDb({
		host: process.env.DATABASE_HOST ?? '127.0.0.1',
		port: Number(process.env.DATABASE_PORT ?? 3306),
		user: process.env.DATABASE_USER ?? 'solmelt',
		password: process.env.DATABASE_PASSWORD ?? 'solmelt_dev',
		database: process.env.DATABASE_NAME ?? 'solmelt_ops',
		connectionLimit: 5,
	})
	return new PrismaClient({ adapter })
}

async function loadDeviceModels(): Promise<SourceDeviceModel[]> {
	const modelsDirectory = resolve('.requirements/学生复现-物模型')
	const entries = await readdir(modelsDirectory, { withFileTypes: true })
	const modelFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right))

	const models = (
		await Promise.all(
			modelFiles.map(async (fileName) => {
				const contents = await readFile(resolve(modelsDirectory, fileName), 'utf8')
				return JSON.parse(contents) as SourceDeviceModel
			}),
		)
	).sort((left, right) => left.deviceCode.localeCompare(right.deviceCode))

	if (models.length !== expectedDeviceCount) {
		throw new Error(`物模型文件数量应为 ${expectedDeviceCount}，实际为 ${models.length}`)
	}

	const canonicalProperties = JSON.stringify(models[0]?.properties)
	for (const model of models) {
		if (model.productKey !== expectedProductKey) {
			throw new Error(`设备 ${model.deviceCode} 的产品标识不符合约定`)
		}
		if (model.properties.length !== expectedPropertyCount) {
			throw new Error(`设备 ${model.deviceCode} 的属性数量不是 ${expectedPropertyCount}`)
		}
		if (JSON.stringify(model.properties) !== canonicalProperties) {
			throw new Error(`设备 ${model.deviceCode} 的属性定义与其他设备不一致`)
		}
	}

	return models
}

function resolvePumpType(deviceCode: string): PumpType {
	if (deviceCode.includes('WSH20')) return PumpType.HOT_SALT
	if (deviceCode.endsWith('050') || deviceCode.endsWith('060')) return PumpType.TEMPERING
	return PumpType.COLD_SALT
}

async function seed(): Promise<void> {
	const prisma = createPrismaClient()
	const models = await loadDeviceModels()
	const firstModel = models[0]
	if (!firstModel) throw new Error('未读取到物模型')

	try {
		const adminRole = await prisma.role.upsert({
			where: { code: 'ADMIN' },
			update: { name: '管理员', remark: '拥有全部菜单与操作权限' },
			create: { code: 'ADMIN', name: '管理员', remark: '拥有全部菜单与操作权限' },
		})
		const operatorRole = await prisma.role.upsert({
			where: { code: 'OPERATOR' },
			update: { name: '普通操作员', remark: '只访问业务页面' },
			create: { code: 'OPERATOR', name: '普通操作员', remark: '只访问业务页面' },
		})

		const menus = [
			['system:user:read', '用户管理', '/system/users', 10],
			['system:user:write', '用户维护', '/system/users', 11],
			['system:role:read', '角色管理', '/system/roles', 20],
			['system:role:write', '角色维护', '/system/roles', 21],
			['device:read', '设备管理', '/devices', 30],
			['device:write', '设备维护', '/devices', 31],
			['telemetry:read', '数据查询', '/telemetry', 40],
			['alarm:read', '报警管理', '/alarms', 50],
			['dashboard:read', '监测大屏', '/dashboard', 60],
		] as const

		const seededMenus = []
		for (const [permissionCode, name, path, sort] of menus) {
			seededMenus.push(
				await prisma.menu.upsert({
					where: { permissionCode },
					update: { name, path, sort },
					create: { permissionCode, name, path, sort },
				}),
			)
		}

		await prisma.roleMenu.deleteMany({
			where: { roleId: { in: [adminRole.id, operatorRole.id] } },
		})

		for (const menu of seededMenus) {
			await prisma.roleMenu.upsert({
				where: { roleId_menuId: { roleId: adminRole.id, menuId: menu.id } },
				update: {},
				create: { roleId: adminRole.id, menuId: menu.id },
			})
			if (!menu.permissionCode?.startsWith('system:') && menu.permissionCode?.endsWith(':read')) {
				await prisma.roleMenu.upsert({
					where: { roleId_menuId: { roleId: operatorRole.id, menuId: menu.id } },
					update: {},
					create: { roleId: operatorRole.id, menuId: menu.id },
				})
			}
		}

		const adminPassword = await hash(process.env.SEED_ADMIN_PASSWORD ?? 'admin123', 12)
		const operatorPassword = await hash(process.env.SEED_OPERATOR_PASSWORD ?? 'operator123', 12)
		await prisma.user.upsert({
			where: { username: 'admin' },
			update: { roleId: adminRole.id, status: UserStatus.ACTIVE, deletedAt: null },
			create: {
				username: 'admin',
				displayName: '系统管理员',
				passwordHash: adminPassword,
				roleId: adminRole.id,
			},
		})
		await prisma.user.upsert({
			where: { username: 'operator' },
			update: { roleId: operatorRole.id, status: UserStatus.ACTIVE, deletedAt: null },
			create: {
				username: 'operator',
				displayName: '普通操作员',
				passwordHash: operatorPassword,
				roleId: operatorRole.id,
			},
		})

		const product = await prisma.product.upsert({
			where: { identifier: firstModel.productKey },
			update: { name: firstModel.productName },
			create: { identifier: firstModel.productKey, name: firstModel.productName },
		})

		for (const [sort, property] of firstModel.properties.entries()) {
			await prisma.productProperty.upsert({
				where: {
					productId_identifier: {
						productId: product.id,
						identifier: property.identifier,
					},
				},
				update: {
					name: property.name,
					dataType: property.dataType === 'BOOL' ? PropertyDataType.BOOL : PropertyDataType.DOUBLE,
					unit: property.unit,
					category: property.category,
					sort,
				},
				create: {
					productId: product.id,
					identifier: property.identifier,
					name: property.name,
					dataType: property.dataType === 'BOOL' ? PropertyDataType.BOOL : PropertyDataType.DOUBLE,
					unit: property.unit,
					category: property.category,
					sort,
				},
			})
		}

		for (const model of models) {
			await prisma.device.upsert({
				where: { deviceCode: model.deviceCode },
				update: {
					name: model.deviceName,
					pumpType: resolvePumpType(model.deviceCode),
					status: DeviceStatus.ENABLED,
					deletedAt: null,
				},
				create: {
					productId: product.id,
					deviceCode: model.deviceCode,
					name: model.deviceName,
					pumpType: resolvePumpType(model.deviceCode),
				},
			})
		}
	} finally {
		await prisma.$disconnect()
	}
}

await seed()
