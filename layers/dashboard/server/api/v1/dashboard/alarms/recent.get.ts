import { authorizeRequest } from '~~/server/core/auth'
import { handleDashboardApi, parseWith } from '../../../../services/api-support'
import { listRecentAlarms } from '../../../../services/dashboard.service'
import { recentAlarmQuerySchema } from '../../../../services/dashboard-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'dashboard:read')
	if (!authorization.authorized) return authorization.response

	return handleDashboardApi(event, () => {
		const query = parseWith(recentAlarmQuerySchema, getQuery(event))
		return listRecentAlarms(query.limit)
	})
})
