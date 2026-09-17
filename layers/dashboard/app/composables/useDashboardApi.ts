import type { ApiErrorCode, ApiResult } from '~~/shared/contracts/api'

/**
 * Auth 层已冻结的凭证约定：JWT 存放于 cookie `solmelt_token`（见 docs/api-contract.md 登录契约）。
 * 大屏只负责读取并转发该凭证，不做签发与验签，因此不复制任何 JWT 逻辑，也不导入 Auth 的私有实现。
 * 领域分支整合后，这一层可整体替换为 auth 的 apiFetch，页面无需改动。
 */
const TOKEN_COOKIE = 'solmelt_token'

export type DashboardRequestErrorCode = ApiErrorCode | 'NETWORK_ERROR'

/** 大屏数据请求失败：保留领域错误码，便于页面区分「登录失效」与「网络/服务异常」。 */
export class DashboardRequestError extends Error {
	readonly code: DashboardRequestErrorCode
	readonly statusCode: number | null

	constructor(message: string, code: DashboardRequestErrorCode, statusCode: number | null) {
		super(message)
		this.name = 'DashboardRequestError'
		this.code = code
		this.statusCode = statusCode
	}
}

/**
 * 只读数据通道：统一附加 Bearer 头并解包 ApiResult。
 * 大屏是只读消费者，因此这里只暴露 GET 语义的 request。
 */
export function useDashboardApi() {
	const token = useCookie<string | null>(TOKEN_COOKIE, { sameSite: 'lax' })
	const hasToken = computed(() => Boolean(token.value))

	async function request<T>(url: string): Promise<T> {
		let response: ApiResult<T>
		try {
			response = await $fetch<ApiResult<T>>(url, {
				method: 'GET',
				...(token.value ? { headers: { Authorization: `Bearer ${token.value}` } } : {}),
			})
		} catch (error) {
			const fetchError = error as {
				statusCode?: number
				data?: { error?: { code?: ApiErrorCode; message?: string } }
			}
			const code: DashboardRequestErrorCode =
				fetchError.data?.error?.code ??
				(fetchError.statusCode === 401
					? 'UNAUTHENTICATED'
					: fetchError.statusCode === 403
						? 'FORBIDDEN'
						: 'NETWORK_ERROR')
			throw new DashboardRequestError(
				fetchError.data?.error?.message ?? '大屏数据请求失败',
				code,
				fetchError.statusCode ?? null,
			)
		}

		if (response.success) return response.data
		throw new DashboardRequestError(response.error.message, response.error.code, null)
	}

	return { request, hasToken }
}
