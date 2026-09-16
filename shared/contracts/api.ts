export interface ApiSuccess<T> {
	success: true
	data: T
	requestId: string
}

export interface ApiErrorBody {
	code: string
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
