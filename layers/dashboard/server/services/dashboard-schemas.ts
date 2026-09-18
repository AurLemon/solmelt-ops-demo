import { z } from 'zod'

/** 近期报警默认与上限条数（冻结契约：默认 10、最多 20）。 */
export const RECENT_ALARM_DEFAULT_LIMIT = 10
export const RECENT_ALARM_MAX_LIMIT = 20

export const recentAlarmQuerySchema = z.object({
	limit: z.coerce
		.number()
		.int('数量必须为整数')
		.min(1, '数量至少为 1')
		.max(RECENT_ALARM_MAX_LIMIT, `数量最多为 ${RECENT_ALARM_MAX_LIMIT}`)
		.default(RECENT_ALARM_DEFAULT_LIMIT),
})
