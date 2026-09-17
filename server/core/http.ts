import type { H3Event } from 'h3'
import type { ApiErrorCode, ApiFailure, ApiSuccess } from '~~/shared/contracts/api'

export function getRequestId(event: H3Event): string {
	return getHeader(event, 'x-request-id') ?? crypto.randomUUID()
}

export function success<T>(event: H3Event, data: T): ApiSuccess<T> {
	return {
		success: true,
		data,
		requestId: getRequestId(event),
	}
}

export function failure(
	event: H3Event,
	statusCode: number,
	code: ApiErrorCode,
	message: string,
	details?: unknown,
): ApiFailure {
	setResponseStatus(event, statusCode)
	return {
		success: false,
		error: {
			code,
			message,
			...(details === undefined ? {} : { details }),
		},
		requestId: getRequestId(event),
	}
}
