import { authorizeRequest } from '~~/server/core/auth'
import { handleDashboardApi } from '../../../services/api-support'
import { getDashboardOverview } from '../../../services/dashboard.service'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'dashboard:read')
	if (!authorization.authorized) return authorization.response

	return handleDashboardApi(event, () => getDashboardOverview())
})
