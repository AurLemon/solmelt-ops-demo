import type { PermissionCode } from '~~/shared/contracts/auth'

/** 无需登录即可访问的页面：仅登录页（未登录访问包括首页在内的其他页面一律跳转登录页）。 */
const publicPaths = new Set(['/login'])

/**
 * 路由守卫：未登录访问系统页面一律跳转登录页。
 * 已登录用户访问登录页时，在服务端就完成 token 校验并直接进入系统，避免登录页闪现。
 * 注意：这只是前端第一道拦截，真正的权限判定由服务端按 PermissionCode 完成。
 */
export default defineNuxtRouteMiddleware(async (to) => {
	const { token, fetchCurrentUser, hasPermission } = useAuth()

	if (to.path === '/login') {
		if (token.value && (await fetchCurrentUser())) return navigateTo('/system/portal')
		return
	}

	if (publicPaths.has(to.path)) return
	if (!token.value) return navigateTo('/login')

	// 不只检查 cookie 是否存在：每次进入受保护页面都由 /me 验证签名、有效期与账号状态。
	const user = await fetchCurrentUser()
	if (!user) return navigateTo('/login')

	// 已登录用户访问根路径时直接进入系统门户。
	if (to.path === '/') return navigateTo('/system/portal')

	// 每个领域页面通过 page meta 声明冻结 PermissionCode；无权用户不进入页面外壳。
	const requiredPermission = to.meta.permission as PermissionCode | undefined
	if (requiredPermission && !hasPermission(requiredPermission)) return navigateTo('/system/portal')
})
