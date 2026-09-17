import { ZodError } from 'zod'
import { success, failure } from '~~/server/core/http'
import { queryAlarms } from '../../../../services/telemetry.service'
import type { AlarmSummary } from '~~/shared/contracts/telemetry'
import type { PageResult } from '~~/shared/contracts/api'

export default defineEventHandler(async (event) => {
	const query = getQuery(event)
	try {
		const result: PageResult<AlarmSummary> = await queryAlarms(query)
		return success(event, result)
	} catch (error: unknown) {
		if (error instanceof ZodError) {
			return failure(event, 400, 'VALIDATION_ERROR', '查询参数校验失败', {
				issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
			})
		}
		return failure(event, 500, 'INTERNAL_ERROR', '报警查询失败')
	}
})
