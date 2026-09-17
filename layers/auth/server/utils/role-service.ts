import type { Prisma } from '~~/generated/prisma/client'
import type { RoleSummary } from '~~/shared/contracts/auth'
import type { PageResult } from '~~/shared/contracts/api'
import { usePrisma } from '~~/server/core/prisma'
import { conflictError, notFoundError, validationError } from './service-error'

const roleWithMenusInclude = { menus: { include: { menu: true } } } satisfies Prisma.RoleInclude

type RoleWithMenus = Prisma.RoleGetPayload<{ include: typeof roleWithMenusInclude }>

/** 服务内部输入：menuIds 已由 zod 解析为数字数组（HTTP 边界仍是字符串 ID）。 */
export interface CreateRoleCommand {
	code: string
	name: string
	remark?: string | undefined
	menuIds: number[]
}

export interface UpdateRoleCommand {
	name: string
	remark?: string | undefined
	menuIds: number[]
}

function toRoleSummary(role: RoleWithMenus): RoleSummary {
	return {
		id: String(role.id),
		code: role.code,
		name: role.name,
		remark: role.remark,
		menuIds: role.menus.map((roleMenu) => String(roleMenu.menuId)),
		createdAt: role.createdAt.toISOString(),
	}
}

async function findRole(id: number): Promise<RoleWithMenus> {
	const role = await usePrisma().role.findUnique({ where: { id }, include: roleWithMenusInclude })
	if (!role) throw notFoundError('角色不存在或已被删除')
	return role
}

async function assertMenusExist(menuIds: number[]): Promise<void> {
	if (menuIds.length === 0) return

	const uniqueIds = [...new Set(menuIds)]
	const count = await usePrisma().menu.count({ where: { id: { in: uniqueIds } } })
	if (count !== uniqueIds.length) throw validationError('菜单列表中存在无效的菜单项')
}

export async function listRoles(query: {
	page: number
	pageSize: number
}): Promise<PageResult<RoleSummary>> {
	const prisma = usePrisma()
	const [total, roles] = await Promise.all([
		prisma.role.count(),
		prisma.role.findMany({
			include: roleWithMenusInclude,
			orderBy: { id: 'asc' },
			skip: (query.page - 1) * query.pageSize,
			take: query.pageSize,
		}),
	])

	return {
		items: roles.map((role) => toRoleSummary(role)),
		page: query.page,
		pageSize: query.pageSize,
		total,
	}
}

export async function createRole(command: CreateRoleCommand): Promise<RoleSummary> {
	await assertMenusExist(command.menuIds)

	const menuIds = [...new Set(command.menuIds)]
	const created = await usePrisma().$transaction(async (tx) => {
		const role = await tx.role.create({
			data: {
				code: command.code,
				name: command.name,
				...(command.remark === undefined ? {} : { remark: command.remark }),
			},
			include: roleWithMenusInclude,
		})
		if (menuIds.length > 0) {
			await tx.roleMenu.createMany({
				data: menuIds.map((menuId) => ({ roleId: role.id, menuId })),
			})
		}
		return role
	})

	return toRoleSummary(created)
}

export async function updateRole(id: number, command: UpdateRoleCommand): Promise<RoleSummary> {
	const existing = await findRole(id)
	await assertMenusExist(command.menuIds)

	const menuIds = [...new Set(command.menuIds)]
	await usePrisma().$transaction(async (tx) => {
		await tx.role.update({
			where: { id: existing.id },
			data: {
				name: command.name,
				...(command.remark === undefined ? {} : { remark: command.remark }),
			},
		})
		await tx.roleMenu.deleteMany({ where: { roleId: existing.id } })
		if (menuIds.length > 0) {
			await tx.roleMenu.createMany({
				data: menuIds.map((menuId) => ({ roleId: existing.id, menuId })),
			})
		}
	})

	return toRoleSummary(await findRole(id))
}

/** 物理删除角色；角色仍被任意用户关联时必须拒绝。 */
export async function deleteRole(id: number): Promise<{ id: string }> {
	const existing = await findRole(id)

	const linkedUsers = await usePrisma().user.count({ where: { roleId: existing.id } })
	if (linkedUsers > 0) {
		throw conflictError(`角色仍被 ${linkedUsers} 个用户关联，无法删除`)
	}

	await usePrisma().$transaction(async (tx) => {
		await tx.roleMenu.deleteMany({ where: { roleId: existing.id } })
		await tx.role.delete({ where: { id: existing.id } })
	})
	return { id: String(existing.id) }
}
