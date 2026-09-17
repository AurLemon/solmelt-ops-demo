export interface ApiSuccess<T> {
	success: true
	data: T
	requestId: string
}

export type ApiErrorCode =
	| 'VALIDATION_ERROR'
	| 'UNAUTHENTICATED'
	| 'FORBIDDEN'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'REPORT_REJECTED'
	| 'DATABASE_UNAVAILABLE'
	| 'INTERNAL_ERROR'

export interface ApiErrorBody {
	code: ApiErrorCode
	message: string
	details?: unknown
}

export interface ApiFailure {
	success: false
	error: ApiErrorBody
	requestId: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export interface PageResult<T> {
	items: T[]
	page: number
	pageSize: number
	total: number
}

export interface PaginationQuery {
	page?: number
	pageSize?: number
}
