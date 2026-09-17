/** 无需登录即可访问的页面：仅登录页（未登录访问包括首页在内的其他页面一律跳转登录页）。 */
const publicPaths = new Set(['/login'])

/**
 * 路由守卫：未登录访问系统页面一律跳转登录页。
 * 已登录用户访问登录页时，在服务端就完成 token 校验并直接进入系统，避免登录页闪现。
 * 注意：这只是前端第一道拦截，真正的权限判定由服务端按 PermissionCode 完成。
 */
export default defineNuxtRouteMiddleware(async (to) => {
	const { token, fetchCurrentUser } = useAuth()

	if (to.path === '/login') {
		if (token.value && (await fetchCurrentUser())) return navigateTo('/system/portal')
		return
	}

	// 已登录用户访问根路径时直接进入系统门户：
	// 公共首页无侧边栏与任何入口，已登录用户落在那里会造成"像没登录"的困惑且无法回到系统。
	if (to.path === '/' && token.value && (await fetchCurrentUser())) {
		return navigateTo('/system/portal')
	}

	if (publicPaths.has(to.path)) return
	if (!token.value) return navigateTo('/login')
})
