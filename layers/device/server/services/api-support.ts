import type { H3Event } from 'h3'
import type { ApiErrorCode, ApiResult } from '~~/shared/contracts/api'
import { failure, success } from '~~/server/core/http'
import type { ZodType, output } from 'zod'

/** 领域服务显式抛出的业务错误，由 handleDeviceApi 统一映射为冻结的 ApiFailure。 */
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

/** 统一成功包装与错误映射：ServiceError 按定义返回，数据库不可用返回 503，其余不向客户端暴露内部细节。 */
export async function handleDeviceApi<T>(
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
		// h3 等框架抛出的带状态码错误按既有状态映射；其余一律 500 INTERNAL_ERROR。
		if (isErrorWithStatusCode(error)) {
			const code = HTTP_STATUS_ERROR_CODES[error.statusCode]
			if (code) {
				return failure(event, error.statusCode, code, error.message)
			}
		}
		return failure(event, 500, 'INTERNAL_ERROR', '服务器内部错误')
	}
}

const HTTP_STATUS_ERROR_CODES: Record<number, ApiErrorCode> = {
	400: 'VALIDATION_ERROR',
	404: 'NOT_FOUND',
	409: 'CONFLICT',
}

function isErrorWithStatusCode(error: unknown): error is { statusCode: number; message: string } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'statusCode' in error &&
		typeof (error as { statusCode: unknown }).statusCode === 'number'
	)
}

function isDatabaseUnavailableError(error: unknown): boolean {
	if (!(error instanceof Error)) return false
	if (error.name === 'PrismaClientInitializationError') return true
	return /Can't reach database server|ECONNREFUSED|ETIMEDOUT|Connection terminated unexpectedly/i.test(
		error.message,
	)
}
