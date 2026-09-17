import type { PermissionCode, RoleCode } from '~~/shared/contracts/auth'
import { usePrisma } from '~~/server/core/prisma'
import { notFoundError } from './service-error'

/** 权限码唯一事实源是 shared/contracts/auth.ts，此列表仅用于运行时校验。 */
const permissionCodeList = [
	'system:user:read',
	'system:user:write',
	'system:role:read',
	'system:role:write',
	'device:read',
	'device:write',
	'telemetry:read',
	'alarm:read',
	'dashboard:read',
] as const satisfies readonly PermissionCode[]

const knownPermissionCodes = new Set<string>(permissionCodeList)

/** 把数据库中的权限码字符串收敛为冻结契约的 PermissionCode。 */
export function parsePermissionCode(value: string): PermissionCode | null {
	return knownPermissionCodes.has(value) ? (value as PermissionCode) : null
}

interface MenuRow {
	id: number
	parentId: number | null
	name: string
	path: string
	permissionCode: string | null
	icon: string | null
	sort: number
}

interface MenuItemNode {
	id: string
	parentId: string | null
	name: string
	path: string
	permissionCode: PermissionCode | null
	icon: string | null
	sort: number
	children: MenuItemNode[]
}

/** 返回指定角色拥有的菜单树（供导航与角色维护页使用）。 */
export async function getMenuTreeForRole(roleCode: RoleCode): Promise<MenuItemNode[]> {
	const role = await usePrisma().role.findUnique({ where: { code: roleCode } })
	if (!role) throw notFoundError('角色不存在或已被删除')

	const menus: MenuRow[] = await usePrisma().menu.findMany({
		where: { roles: { some: { roleId: role.id } } },
		orderBy: [{ sort: 'asc' }, { id: 'asc' }],
	})

	return buildTree(menus, null)
}

function buildTree(menus: MenuRow[], parentId: number | null): MenuItemNode[] {
	const children = menus.filter((menu) => menu.parentId === parentId)
	return children.map((menu) => ({
		id: String(menu.id),
		parentId: menu.parentId === null ? null : String(menu.parentId),
		name: menu.name,
		path: menu.path,
		permissionCode: menu.permissionCode === null ? null : parsePermissionCode(menu.permissionCode),
		icon: menu.icon,
		sort: menu.sort,
		children: buildTree(menus, menu.id),
	}))
}
