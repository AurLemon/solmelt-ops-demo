import { compare, hash } from 'bcryptjs'
import type { Prisma } from '~~/generated/prisma/client'
import { UserStatus as DbUserStatus } from '~~/generated/prisma/client'
import type {
	AuthenticatedUser,
	PermissionCode,
	UserStatus,
	UserSummary,
} from '~~/shared/contracts/auth'
import type { PageResult } from '~~/shared/contracts/api'
import { usePrisma } from '~~/server/core/prisma'
import { conflictError, forbiddenError, notFoundError, unauthenticatedError } from './service-error'
import { parsePermissionCode } from './menu-service'

const PASSWORD_HASH_COST = 12

const userWithRoleInclude = { role: true } satisfies Prisma.UserInclude

type UserWithRole = Prisma.UserGetPayload<{ include: typeof userWithRoleInclude }>

/** 服务内部输入：roleId 已由 zod 解析为数字（HTTP 边界仍是字符串 ID）。 */
export interface CreateUserCommand {
	username: string
	password: string
	displayName: string
	roleId: number
	status: UserStatus
}

export interface UpdateUserCommand {
	displayName: string
	roleId: number
	status: UserStatus
}

function toUserStatus(status: DbUserStatus): UserStatus {
	return status === DbUserStatus.ACTIVE ? 'ACTIVE' : 'DISABLED'
}

function toUserSummary(user: UserWithRole): UserSummary {
	return {
		id: String(user.id),
		username: user.username,
		displayName: user.displayName,
		role: user.role.code,
		status: toUserStatus(user.status),
		createdAt: user.createdAt.toISOString(),
	}
}

async function findActiveUser(id: number): Promise<UserWithRole> {
	const user = await usePrisma().user.findUnique({
		where: { id },
		include: userWithRoleInclude,
	})
	if (!user || user.deletedAt) throw notFoundError('用户不存在或已被删除')
	return user
}

async function assertRoleExists(roleId: number): Promise<void> {
	const role = await usePrisma().role.findUnique({ where: { id: roleId } })
	if (!role) throw notFoundError('所选角色不存在')
}

/** 收集角色的全部权限码（经 role_menus 关联菜单）。 */
export async function rolePermissionCodes(roleId: number): Promise<PermissionCode[]> {
	const role = await usePrisma().role.findUnique({
		where: { id: roleId },
		include: { menus: { include: { menu: true } } },
	})
	if (!role) throw notFoundError('角色不存在或已被删除')

	return role.menus
		.map((roleMenu) =>
			roleMenu.menu.permissionCode === null
				? null
				: parsePermissionCode(roleMenu.menu.permissionCode),
		)
		.filter((code): code is PermissionCode => code !== null)
}

export async function authenticateUser(
	username: string,
	password: string,
): Promise<AuthenticatedUser> {
	const user = await usePrisma().user.findUnique({
		where: { username },
		include: { role: { include: { menus: { include: { menu: true } } } } },
	})
	if (!user || user.deletedAt) throw unauthenticatedError('用户名或密码错误')
	if (user.status === DbUserStatus.DISABLED) {
		throw forbiddenError('账号已被禁用，请联系管理员')
	}

	const passwordMatches = await compare(password, user.passwordHash)
	if (!passwordMatches) throw unauthenticatedError('用户名或密码错误')

	return {
		id: String(user.id),
		username: user.username,
		displayName: user.displayName,
		role: user.role.code,
		permissions: user.role.menus
			.map((roleMenu) =>
				roleMenu.menu.permissionCode === null
					? null
					: parsePermissionCode(roleMenu.menu.permissionCode),
			)
			.filter((code): code is PermissionCode => code !== null),
	}
}

/** 读取当前登录用户的最新信息（校验账号仍有效）。 */
export async function getCurrentUser(id: number): Promise<AuthenticatedUser> {
	const user = await findActiveUser(id)
	if (user.status === DbUserStatus.DISABLED) throw unauthenticatedError('账号已被禁用')

	return {
		id: String(user.id),
		username: user.username,
		displayName: user.displayName,
		role: user.role.code,
		permissions: await rolePermissionCodes(user.roleId),
	}
}

export async function listUsers(query: {
	page: number
	pageSize: number
	keyword?: string | undefined
}): Promise<PageResult<UserSummary>> {
	const where: Prisma.UserWhereInput = { deletedAt: null }
	if (query.keyword) {
		where.OR = [
			{ username: { contains: query.keyword } },
			{ displayName: { contains: query.keyword } },
		]
	}

	const prisma = usePrisma()
	const [total, users] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			include: userWithRoleInclude,
			orderBy: { id: 'asc' },
			skip: (query.page - 1) * query.pageSize,
			take: query.pageSize,
		}),
	])

	return {
		items: users.map((user) => toUserSummary(user)),
		page: query.page,
		pageSize: query.pageSize,
		total,
	}
}

export async function createUser(command: CreateUserCommand): Promise<UserSummary> {
	await assertRoleExists(command.roleId)

	const existing = await usePrisma().user.findUnique({ where: { username: command.username } })
	if (existing && !existing.deletedAt) throw conflictError('用户名已存在')

	const user = await usePrisma().user.create({
		data: {
			username: command.username,
			passwordHash: await hash(command.password, PASSWORD_HASH_COST),
			displayName: command.displayName,
			roleId: command.roleId,
			status: command.status === 'ACTIVE' ? DbUserStatus.ACTIVE : DbUserStatus.DISABLED,
		},
		include: userWithRoleInclude,
	})
	return toUserSummary(user)
}

export async function updateUser(id: number, command: UpdateUserCommand): Promise<UserSummary> {
	const user = await findActiveUser(id)
	await assertRoleExists(command.roleId)

	const updated = await usePrisma().user.update({
		where: { id: user.id },
		data: {
			displayName: command.displayName,
			roleId: command.roleId,
			status: command.status === 'ACTIVE' ? DbUserStatus.ACTIVE : DbUserStatus.DISABLED,
		},
		include: userWithRoleInclude,
	})
	return toUserSummary(updated)
}

/** 逻辑删除；当前登录账号不允许删除自己。 */
export async function deleteUser(id: number, currentUserId: string): Promise<{ id: string }> {
	const user = await findActiveUser(id)
	if (String(user.id) === currentUserId) {
		throw conflictError('不能删除当前登录账号')
	}

	await usePrisma().user.update({ where: { id: user.id }, data: { deletedAt: new Date() } })
	return { id: String(user.id) }
}

export async function resetUserPassword(id: number, newPassword: string): Promise<{ id: string }> {
	const user = await findActiveUser(id)
	await usePrisma().user.update({
		where: { id: user.id },
		data: { passwordHash: await hash(newPassword, PASSWORD_HASH_COST) },
	})
	return { id: String(user.id) }
}
