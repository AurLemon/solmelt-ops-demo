import type { H3Event } from 'h3'
import type { ApiErrorCode, ApiResult } from '~~/shared/contracts/api'
import { failure, success } from '~~/server/core/http'
import type { ZodType, output } from 'zod'

/** 领域服务显式抛出的业务错误，由 handleDashboardApi 统一映射为冻结的 ApiFailure。 */
export class ServiceError extends Error {
	readonly statusCode: number
	readonly code: ApiErrorCode

	constructor(statusCode: number, code: ApiErrorCode, message: string) {
		super(message)
		this.name = 'ServiceError'
		this.statusCode = statusCode
		this.code = code
	}
}

/** 校验请求输入，失败时抛出 400 VALIDATION_ERROR。 */
export function parseWith<Schema extends ZodType>(schema: Schema, value: unknown): output<Schema> {
	const result = schema.safeParse(value)
	if (!result.success) {
		const issue = result.error.issues[0]
		const path = issue && issue.path.length > 0 ? issue.path.map(String).join('.') : '请求'
		const message = issue ? issue.message : '请求参数不符合契约'
		throw new ServiceError(400, 'VALIDATION_ERROR', `${path}: ${message}`)
	}
	return result.data
}

const DATABASE_UNAVAILABLE_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017'])

function isDatabaseUnavailableError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false
	const code = (error as { code?: unknown }).code
	return typeof code === 'string' && DATABASE_UNAVAILABLE_CODES.has(code)
}

function isErrorWithStatusCode(error: unknown): error is { statusCode: number; message: string } {
	if (typeof error !== 'object' || error === null) return false
	const statusCode = (error as { statusCode?: unknown }).statusCode
	return (
		typeof statusCode === 'number' && typeof (error as { message?: unknown }).message === 'string'
	)
}

const HTTP_STATUS_ERROR_CODES: Record<number, ApiErrorCode> = {
	400: 'VALIDATION_ERROR',
	401: 'UNAUTHENTICATED',
	403: 'FORBIDDEN',
	404: 'NOT_FOUND',
	409: 'CONFLICT',
}

/**
 * 统一成功包装与错误映射：ServiceError 按定义返回，数据库不可用返回 503，
 * 其余内部细节一律不外泄给客户端。
 */
export async function handleDashboardApi<T>(
	event: H3Event,
	action: () => Promise<T> | T,
): Promise<ApiResult<T>> {
	try {
		return success(event, await action())
	} catch (error) {
		if (error instanceof ServiceError) {
			return failure(event, error.statusCode, error.code, error.message)
		}
		if (isDatabaseUnavailableError(error)) {
			return failure(event, 503, 'DATABASE_UNAVAILABLE', '数据库暂时不可用')
		}
		if (isErrorWithStatusCode(error)) {
			const code = HTTP_STATUS_ERROR_CODES[error.statusCode]
			if (code) {
				return failure(event, error.statusCode, code, error.message)
			}
		}
		return failure(event, 500, 'INTERNAL_ERROR', '服务器内部错误')
	}
}
