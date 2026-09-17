import { ZodError } from 'zod'
import { success, failure } from '~~/server/core/http'
import { updateAlarmStatus, TelemetryError } from '../../../../../services/telemetry.service'

export default defineEventHandler(async (event) => {
	const alarmId = getRouterParam(event, 'id') ?? ''
	const body = await readBody(event)
	try {
		const result = await updateAlarmStatus(alarmId, body)
		return success(event, result)
	} catch (error: unknown) {
		if (error instanceof ZodError) {
			return failure(event, 400, 'VALIDATION_ERROR', '请求参数校验失败', {
				issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
			})
		}
		if (error instanceof TelemetryError) {
			return failure(event, 404, error.code, error.message)
		}
		return failure(event, 500, 'INTERNAL_ERROR', '报警状态变更失败')
	}
})
