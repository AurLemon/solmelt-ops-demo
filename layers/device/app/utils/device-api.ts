/**
 * 设备领域 - 接口消费层
 * ---------------------------------------------------------------------------
 * 唯一职责：把 `docs/api-contract.md` 的 Device 端点收敛成类型安全函数，
 * 并把冻结的 `ApiResult<T>` 统一拆包为 `data` 或抛出可展示的错误。
 *
 * 本层不做任何数据加工、不生成默认值、不缓存业务状态：
 *   - 未上报的属性值由 `GET /devices/:id/latest` 返回空，页面据此渲染「—」，
 *     这里绝不补 0 / false / 默认值。
 *   - 「在线」是服务端按 300 秒窗口派生的只读字段，这里不计算、不覆写。
 *
 * 鉴权说明：受保护接口需要 `Authorization: Bearer <token>`（见 docs/api-contract.md）。
 * 凭证由 Auth 领域维护在浏览器 cookie 中；本层不读取也不复制 Auth 的私有实现，
 * 只在 SSR 阶段把请求携带的 cookie 原样转发给同源接口，浏览器阶段由 $fetch 自行带上。
 */

import type { ApiResult, PageResult } from '~~/shared/contracts/api'
import type {
	DeviceLatestValue,
	DeviceSummary,
	DeviceStatus,
	CreateDeviceInput,
	CreateProductInput,
	ProductImportResult,
	ProductPropertyDefinition,
	ProductSummary,
	UpdateDeviceInput,
} from '~~/shared/contracts/device'

/** 统一的只读请求失败信息，携带冻结契约中的 error.code 便于页面区分空/错误状态。 */
export class DeviceApiError extends Error {
	readonly statusCode: number
	readonly code: string

	constructor(statusCode: number, code: string, message: string) {
		super(message)
		this.name = 'DeviceApiError'
		this.statusCode = statusCode
		this.code = code
	}
}

/**
 * 受保护接口需要 `Authorization: Bearer <token>`（见 docs/api-contract.md）。
 * 登录凭证由 Auth 领域写入名为 `solmelt_token` 的 cookie（该名称为双方约定的集成点，
 * 见 layers/auth/app/composables/useAuth.ts）。本层不 import Auth 的任何实现，
 * 在服务端从请求 cookie、在客户端从 document.cookie 取出 token 组装请求头。
 */
const TOKEN_COOKIE_NAME = 'solmelt_token'

/**
 * 解析当前请求的鉴权头。
 *
 * 必须在 Vue setup 的同步阶段调用一次，再把结果传给各请求函数：
 * `useRequestHeaders` / `useCookie` 依赖 Nuxt 实例，若放到多段 await 之后调用，
 * 上下文已丢失并抛出 NUXT_E1001。
 */
export function resolveAuthHeaders(): Record<string, string> {
	// 服务端优先使用上游直接透传的 Authorization（例如由 Auth 的调用链带入）。
	if (import.meta.server) {
		const forwarded = useRequestHeaders(['authorization']).authorization
		if (forwarded) return { authorization: forwarded }
	}

	// 客户端导航/刷新时页面已在浏览器运行，此时按同一约定从 cookie 取 token 组装
	// Bearer 头（服务端接口只认 Authorization 头，浏览器自动携带的 cookie 本身不被接受）。
	const token = useCookie<string | null>(TOKEN_COOKIE_NAME).value
	return token ? { authorization: `Bearer ${token}` } : {}
}

/** 每批请求共用的鉴权头；为空对象时 $fetch 不会附加任何头。 */
export type AuthHeaders = Record<string, string>

/** 统一的只读请求入口：拆包 ApiResult<T>，失败时抛出 DeviceApiError。 */
async function request<T>(
	url: string,
	authHeaders: AuthHeaders,
	query?: Record<string, unknown>,
): Promise<T> {
	let result: ApiResult<T>
	try {
		result = await $fetch<ApiResult<T>>(url, {
			...(query ? { query } : {}),
			headers: authHeaders,
		})
	} catch (error) {
		// 非 2xx 时 $fetch 会抛错，契约里的 ApiFailure 在 error.data 上。
		throw toDeviceApiError(error)
	}

	// 防御性分支：若服务端以 2xx 返回 success:false，仍按契约转为错误。
	if (!result.success) {
		throw new DeviceApiError(0, result.error.code, result.error.message)
	}
	return result.data
}

/** 查询设备分页列表。只读，仅需 device:read。 */
export function fetchDevicePage(
	authHeaders: AuthHeaders,
	query: {
		page: number
		pageSize: number
		keyword?: string
		status?: DeviceStatus
		productId?: string
	},
): Promise<PageResult<DeviceSummary>> {
	return request<PageResult<DeviceSummary>>('/api/v1/device/devices', authHeaders, {
		page: query.page,
		pageSize: query.pageSize,
		...(query.keyword ? { keyword: query.keyword } : {}),
		...(query.status ? { status: query.status } : {}),
		...(query.productId ? { productId: query.productId } : {}),
	})
}

/** 查询单台设备详情。只读，仅需 device:read。 */
export function fetchDeviceDetail(id: string, authHeaders: AuthHeaders): Promise<DeviceSummary> {
	return request<DeviceSummary>(`/api/v1/device/devices/${id}`, authHeaders)
}

/**
 * 查询设备最新属性值。只读冻结投影，不写入。
 * 未上报时服务端返回空数组，页面据此对每个属性展示「—」。
 */
export function fetchDeviceLatest(
	id: string,
	authHeaders: AuthHeaders,
): Promise<DeviceLatestValue[]> {
	return request<DeviceLatestValue[]>(`/api/v1/device/devices/${id}/latest`, authHeaders)
}

/** 查询产品列表，用于详情页展示设备所属产品。只读，仅需 device:read。 */
export function fetchProducts(authHeaders: AuthHeaders): Promise<ProductSummary[]> {
	return request<ProductSummary[]>('/api/v1/device/products', authHeaders)
}

/** 查询产品的 30 个属性定义。只读，仅需 device:read。 */
export function fetchProductProperties(
	productId: string,
	authHeaders: AuthHeaders,
): Promise<ProductPropertyDefinition[]> {
	return request<ProductPropertyDefinition[]>(
		`/api/v1/device/products/${productId}/properties`,
		authHeaders,
	)
}

/** 创建固定的立式熔盐泵产品。 */
export function createProduct(
	input: CreateProductInput,
	authHeaders: AuthHeaders,
): Promise<ProductSummary> {
	return mutate<ProductSummary>('/api/v1/device/products', 'POST', input, authHeaders)
}

/** 上传一份教师物模型 JSON，服务端完成 30 属性一致性校验与幂等导入。 */
export function importProductProperties(
	productId: string,
	file: File,
	authHeaders: AuthHeaders,
): Promise<ProductImportResult> {
	const form = new FormData()
	form.append('file', file)
	return mutate<ProductImportResult>(
		`/api/v1/device/products/${productId}/import`,
		'POST',
		form,
		authHeaders,
	)
}

/** 新增老师目录内的设备实例。 */
export function createDevice(
	input: CreateDeviceInput,
	authHeaders: AuthHeaders,
): Promise<DeviceSummary> {
	return mutate<DeviceSummary>('/api/v1/device/devices', 'POST', input, authHeaders)
}

/** 编辑设备名称、泵型和启用状态。 */
export function updateDevice(
	id: string,
	input: UpdateDeviceInput,
	authHeaders: AuthHeaders,
): Promise<DeviceSummary> {
	return mutate<DeviceSummary>(`/api/v1/device/devices/${id}`, 'PUT', input, authHeaders)
}

/** 逻辑删除设备。 */
export function deleteDevice(id: string, authHeaders: AuthHeaders): Promise<{ id: string }> {
	return mutate<{ id: string }>(`/api/v1/device/devices/${id}`, 'DELETE', undefined, authHeaders)
}

async function mutate<T>(
	url: string,
	method: 'POST' | 'PUT' | 'DELETE',
	body: unknown,
	authHeaders: AuthHeaders,
): Promise<T> {
	let result: ApiResult<T>
	try {
		result = await $fetch<ApiResult<T>>(url, {
			method,
			...(body === undefined ? {} : { body }),
			headers: authHeaders,
		})
	} catch (error) {
		throw toDeviceApiError(error)
	}

	if (!result.success) {
		throw new DeviceApiError(0, result.error.code, result.error.message)
	}
	return result.data
}

/** 把 $fetch 抛出的错误映射为带契约 code 的 DeviceApiError。 */
function toDeviceApiError(error: unknown): DeviceApiError {
	if (error instanceof DeviceApiError) return error

	const statusCode =
		typeof error === 'object' && error !== null && 'statusCode' in error
			? Number((error as { statusCode: unknown }).statusCode)
			: 0
	const body =
		typeof error === 'object' && error !== null && 'data' in error
			? (error as { data: unknown }).data
			: undefined

	if (typeof body === 'object' && body !== null && 'error' in body) {
		const apiError = (body as { error: { code?: unknown; message?: unknown } }).error
		return new DeviceApiError(
			statusCode,
			typeof apiError.code === 'string' ? apiError.code : 'INTERNAL_ERROR',
			typeof apiError.message === 'string' ? apiError.message : '请求失败',
		)
	}

	return new DeviceApiError(statusCode, 'INTERNAL_ERROR', '无法连接到设备接口')
}

/**
 * 从 useAsyncData 的 error 中取出可展示的中文消息。
 *
 * useAsyncData 会把抛出的错误包装成 NuxtError，原始 DeviceApiError 的原型链会丢失，
 * 因此不能只用 instanceof 判断，需要同时读取 message 与响应体里的 error.message。
 */
export function describeFetchError(error: unknown, fallback: string): string {
	if (!error) return ''

	if (error instanceof DeviceApiError) return presentableMessage(error.message)

	if (typeof error === 'object' && error !== null) {
		const candidate = error as { data?: unknown; message?: unknown }

		// NuxtError 会把服务端返回的 ApiFailure 放在 data 上。
		if (
			typeof candidate.data === 'object' &&
			candidate.data !== null &&
			'error' in candidate.data
		) {
			const apiError = (candidate.data as { error: { message?: unknown } }).error
			if (typeof apiError.message === 'string' && apiError.message) {
				return presentableMessage(apiError.message)
			}
		}

		// 已是 ApiFailure 形状（$fetch 非 2xx 时 h3 会这样抛出）。
		if ('error' in candidate) {
			const apiError = (candidate as { error: { message?: unknown } }).error
			if (
				typeof apiError === 'object' &&
				apiError !== null &&
				typeof apiError.message === 'string' &&
				apiError.message
			) {
				return presentableMessage(apiError.message)
			}
		}

		if (typeof candidate.message === 'string' && candidate.message) {
			return presentableMessage(candidate.message)
		}
	}

	return fallback
}

/**
 * 过滤不适合直接展示给用户的技术性消息。
 * 例如非法路由参数会返回 zod 的原始英文报错
 * （`Invalid input: expected number, received NaN`），此处换成中文提示。
 */
function presentableMessage(message: string): string {
	if (/Invalid input|expected number|received NaN|ZodError/i.test(message)) {
		return '请求参数不合法，请从设备列表进入详情页'
	}
	return message
}
