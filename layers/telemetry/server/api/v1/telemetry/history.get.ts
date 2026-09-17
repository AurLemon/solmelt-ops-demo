import { ZodError } from 'zod'
import { success, failure } from '~~/server/core/http'
import { queryHistory } from '../../../services/telemetry.service'
import type { TelemetryPoint } from '~~/shared/contracts/telemetry'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	try {
		const points: TelemetryPoint[] = await queryHistory(query)
		return success(event, points)
	} catch (error: unknown) {
		if (error instanceof ZodError) {
			return failure(event, 400, 'VALIDATION_ERROR', '查询参数校验失败', {
				issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
			})
		}
		return failure(event, 500, 'INTERNAL_ERROR', '历史查询失败')
	}
})
