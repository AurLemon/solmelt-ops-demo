import { z } from 'zod'

export const deviceIdParamSchema = z.coerce
	.number()
	.int('ID 必须为整数')
	.positive('ID 必须为正整数')

export const productIdParamSchema = deviceIdParamSchema

export const deviceListQuerySchema = z.object({
	page: z.coerce.number().int('页码必须为整数').min(1, '页码从 1 开始').default(1),
	pageSize: z.coerce
		.number()
		.int('每页数量必须为整数')
		.min(1, '每页至少 1 条')
		.max(100, '每页最多 100 条')
		.default(20),
	keyword: z.string().trim().max(64, '关键词最长 64 字符').optional(),
	status: z.enum(['ENABLED', 'DISABLED']).optional(),
	productId: z.coerce.number().int().positive().optional(),
})

export const createProductSchema = z.object({
	identifier: z.string().trim().min(1, '产品标识不能为空').max(64),
	name: z.string().trim().min(1, '产品名称不能为空').max(100),
	remark: z.string().trim().max(255, '备注最长 255 字符').optional(),
})

export const createDeviceSchema = z.object({
	productId: z.coerce.number().int().positive('产品 ID 必须为正整数'),
	deviceCode: z.string().trim().min(1, '设备编号不能为空').max(64),
	name: z.string().trim().min(1, '设备名称不能为空').max(100),
	pumpType: z.enum(['COLD_SALT', 'TEMPERING', 'HOT_SALT']),
	status: z.enum(['ENABLED', 'DISABLED']),
})

export const updateDeviceSchema = z.object({
	name: z.string().trim().min(1, '设备名称不能为空').max(100),
	pumpType: z.enum(['COLD_SALT', 'TEMPERING', 'HOT_SALT']),
	status: z.enum(['ENABLED', 'DISABLED']),
})

export const deviceModelPayloadSchema = z.object({
	productKey: z.string().min(1),
	productName: z.string().min(1),
	properties: z
		.array(
			z.object({
				identifier: z.string().min(1),
				name: z.string().min(1),
				dataType: z.enum(['BOOL', 'DOUBLE']),
				unit: z.string(),
				category: z.string().min(1),
			}),
		)
		.min(1),
})
