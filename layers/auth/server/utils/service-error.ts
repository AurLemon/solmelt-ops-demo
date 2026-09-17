import type { ApiErrorCode } from '~~/shared/contracts/api'

/** 领域业务错误：由端点统一转换为 ApiResult 失败响应。 */
export class ServiceError extends Error {
	readonly statusCode: number
	readonly errorCode: ApiErrorCode

	constructor(statusCode: number, errorCode: ApiErrorCode, message: string) {
		super(message)
		this.name = 'ServiceError'
		this.statusCode = statusCode
		this.errorCode = errorCode
	}
}

export function validationError(message: string): ServiceError {
	return new ServiceError(400, 'VALIDATION_ERROR', message)
}

export function unauthenticatedError(message: string): ServiceError {
	return new ServiceError(401, 'UNAUTHENTICATED', message)
}

export function forbiddenError(message: string): ServiceError {
	return new ServiceError(403, 'FORBIDDEN', message)
}

export function notFoundError(message: string): ServiceError {
	return new ServiceError(404, 'NOT_FOUND', message)
}

export function conflictError(message: string): ServiceError {
	return new ServiceError(409, 'CONFLICT', message)
}
