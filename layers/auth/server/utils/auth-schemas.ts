import { z } from 'zod'

export const loginInputSchema = z.object({
	username: z.string({ message: '用户名必须是字符串' }).min(1, '用户名不能为空'),
	password: z.string({ message: '密码必须是字符串' }).min(1, '密码不能为空'),
	captcha: z.string({ message: '验证码必须是字符串' }).min(1, '验证码不能为空'),
	captchaKey: z.string({ message: '验证码标识必须是字符串' }).min(1, '验证码标识不能为空'),
})

export const userStatusSchema = z.enum(['ACTIVE', 'DISABLED'], {
	message: '状态只能是 ACTIVE 或 DISABLED',
})

export const createUserSchema = z.object({
	username: z
		.string({ message: '用户名必须是字符串' })
		.min(2, '用户名至少 2 个字符')
		.max(64, '用户名最多 64 个字符')
		.regex(/^[A-Za-z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
	password: z
		.string({ message: '密码必须是字符串' })
		.min(6, '密码至少 6 位')
		.max(72, '密码最多 72 位'),
	displayName: z
		.string({ message: '显示名必须是字符串' })
		.min(1, '显示名不能为空')
		.max(100, '显示名最多 100 个字符'),
	roleId: z.coerce.number({ message: '角色 ID 必须是数字' }).int().positive('角色 ID 必须是正整数'),
	status: userStatusSchema,
})

export const updateUserSchema = z.object({
	displayName: z
		.string({ message: '显示名必须是字符串' })
		.min(1, '显示名不能为空')
		.max(100, '显示名最多 100 个字符'),
	roleId: z.coerce.number({ message: '角色 ID 必须是数字' }).int().positive('角色 ID 必须是正整数'),
	status: userStatusSchema,
})

export const resetPasswordSchema = z.object({
	password: z
		.string({ message: '密码必须是字符串' })
		.min(6, '密码至少 6 位')
		.max(72, '密码最多 72 位'),
})

export const userListQuerySchema = z.object({
	page: z.coerce.number().int().min(1, 'page 从 1 开始').default(1),
	pageSize: z.coerce.number().int().min(1).max(100, 'pageSize 最多 100').default(20),
	keyword: z.string().max(64, '关键字最多 64 个字符').optional(),
})

export const createRoleSchema = z.object({
	code: z
		.string({ message: '角色编码必须是字符串' })
		.min(2, '角色编码至少 2 个字符')
		.max(32, '角色编码最多 32 个字符')
		.regex(/^[A-Z0-9_]+$/, '角色编码只能包含大写字母、数字和下划线'),
	name: z
		.string({ message: '角色名必须是字符串' })
		.min(1, '角色名不能为空')
		.max(64, '角色名最多 64 个字符'),
	remark: z.string().max(255, '备注最多 255 个字符').optional(),
	menuIds: z.array(z.coerce.number().int().positive(), { message: '菜单 ID 列表必须是数组' }),
})

export const updateRoleSchema = z.object({
	name: z
		.string({ message: '角色名必须是字符串' })
		.min(1, '角色名不能为空')
		.max(64, '角色名最多 64 个字符'),
	remark: z.string().max(255, '备注最多 255 个字符').optional(),
	menuIds: z.array(z.coerce.number().int().positive(), { message: '菜单 ID 列表必须是数组' }),
})

export const paginationQuerySchema = z.object({
	page: z.coerce.number().int().min(1, 'page 从 1 开始').default(1),
	pageSize: z.coerce.number().int().min(1).max(100, 'pageSize 最多 100').default(20),
})
