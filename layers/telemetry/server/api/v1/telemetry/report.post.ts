import { ZodError } from 'zod'
import { success, failure } from '~~/server/core/http'
import { reportTelemetry, TelemetryError } from '../../../services/telemetry.service'
import type { TelemetryReportResult } from '~~/shared/contracts/telemetry'

export default defineEventHandler(async (event) => {
	const body = await readBody(event)

	try {
		const result: TelemetryReportResult = await reportTelemetry(body)
		return success(event, result)
	} catch (error: unknown) {
		if (error instanceof ZodError) {
			return failure(event, 400, 'VALIDATION_ERROR', '请求参数校验失败', {
				issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
			})
		}
		if (error instanceof TelemetryError) {
			const statusMap: Record<TelemetryError['code'], number> = {
				REPORT_REJECTED: 422,
				VALIDATION_ERROR: 400,
				NOT_FOUND: 404,
			}
			return failure(event, statusMap[error.code], error.code, error.message)
		}
		return failure(event, 500, 'INTERNAL_ERROR', '上报处理失败')
	}
})
