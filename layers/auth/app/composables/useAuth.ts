import type { ApiResult } from '~~/shared/contracts/api'
import type { AuthenticatedUser, LoginResult, PermissionCode } from '~~/shared/contracts/auth'

const TOKEN_COOKIE = 'solmelt_token'
const TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60

interface ApiCallOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
	body?: unknown
	skipAuthRedirect?: boolean
}

/**
 * 登录态管理：token 存于 cookie（SSR 中间件可读），当前用户存于全局 state。
 * 所有带鉴权的接口调用都应通过 apiFetch，自动附加 Bearer 头并统一处理 401。
 */
export function useAuth() {
	const token = useCookie<string | null>(TOKEN_COOKIE, {
		maxAge: TOKEN_MAX_AGE_SECONDS,
		sameSite: 'lax',
	})
	const user = useState<AuthenticatedUser | null>('solmelt-auth-user', () => null)

	function authHeaders(): Record<string, string> {
		return token.value ? { Authorization: `Bearer ${token.value}` } : {}
	}

	async function clearSession(): Promise<void> {
		token.value = null
		user.value = null
	}

	async function apiFetch<T>(url: string, options: ApiCallOptions = {}): Promise<T> {
		let response: ApiResult<T>
		try {
			response = await $fetch<ApiResult<T>>(url, {
				method: options.method ?? 'GET',
				...(options.body === undefined ? {} : { body: options.body }),
				headers: authHeaders(),
			})
		} catch (error) {
			const fetchError = error as {
				statusCode?: number
				message?: string
				data?: { error?: { message?: string }; message?: string }
			}
			if (fetchError.statusCode === 401) {
				await clearSession()
				if (!options.skipAuthRedirect) await navigateTo('/login')
			}
			// 优先展示后端 ApiFailure 里的具体原因（如“显示名不能为空”），而非 HTTP 层的 “400 Bad Request”。
			const backendMessage = fetchError.data?.error?.message ?? fetchError.data?.message
			throw new Error(backendMessage ?? fetchError.message ?? '网络请求失败', { cause: error })
		}

		if (response.success) return response.data

		if (response.error.code === 'UNAUTHENTICATED') {
			await clearSession()
			if (!options.skipAuthRedirect) await navigateTo('/login')
		}
		throw new Error(response.error.message)
	}

	async function login(input: {
		username: string
		password: string
		captcha: string
		captchaKey: string
	}): Promise<LoginResult> {
		const result = await apiFetch<LoginResult>('/api/v1/auth/login', {
			method: 'POST',
			body: input,
			skipAuthRedirect: true,
		})
		token.value = result.token
		user.value = result.user
		return result
	}

	/** 用 /me 校验 token 并刷新当前用户；失效时清理会话并返回 null。 */
	async function fetchCurrentUser(): Promise<AuthenticatedUser | null> {
		if (!token.value) return null
		try {
			user.value = await apiFetch<AuthenticatedUser>('/api/v1/auth/me')
			return user.value
		} catch {
			return null
		}
	}

	async function logout(): Promise<void> {
		await clearSession()
		await navigateTo('/login')
	}

	function hasPermission(code: PermissionCode): boolean {
		return user.value?.permissions.includes(code) ?? false
	}

	return { token, user, login, logout, fetchCurrentUser, hasPermission, authHeaders, apiFetch }
}
