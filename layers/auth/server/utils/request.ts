import type { H3Event } from 'h3'
import { z } from 'zod'
import type { ApiFailure, ApiSuccess } from '~~/shared/contracts/api'
import { failure, success } from '~~/server/core/http'
import { Prisma } from '~~/generated/prisma/client'
import { ServiceError, validationError } from './service-error'

/** 统一把 Service 结果或异常转换为 ApiResult 响应。 */
export async function respond<T>(
	event: H3Event,
	run: () => Promise<T>,
): Promise<ApiSuccess<T> | ApiFailure> {
	try {
		return success(event, await run())
	} catch (error) {
		if (error instanceof ServiceError) {
			return failure(event, error.statusCode, error.errorCode, error.message)
		}
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			return failure(event, 409, 'CONFLICT', '唯一键重复：目标记录已存在')
		}
		return failure(event, 503, 'DATABASE_UNAVAILABLE', '数据库暂时不可用')
	}
}

/** 解析 JSON 请求体，失败时抛出契约定义的 VALIDATION_ERROR。 */
export async function parseBody<S extends z.ZodType>(
	event: H3Event,
	schema: S,
): Promise<z.output<S>> {
	const raw: unknown = await readBody(event).catch(() => undefined)
	return parseOrThrow(schema, raw ?? {})
}

/** 解析 URL 查询参数，失败时抛出契约定义的 VALIDATION_ERROR。 */
export function parseQuery<S extends z.ZodType>(event: H3Event, schema: S): z.output<S> {
	const raw: unknown = getQuery(event)
	return parseOrThrow(schema, raw)
}

/** 解析路由数字 ID 参数。 */
export function parseIdParam(event: H3Event): number {
	const raw: unknown = getRouterParam(event, 'id')
	const result = z.coerce.number().int().positive().safeParse(raw)
	if (!result.success) throw validationError('路径参数 id 必须是正整数')
	return result.data
}

function parseOrThrow<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
	const result = schema.safeParse(raw)
	if (!result.success) {
		const firstIssue = result.error.issues[0]
		throw validationError(firstIssue?.message ?? '请求参数不符合契约')
	}
	return result.data
}
