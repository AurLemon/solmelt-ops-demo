import { authorizeRequest } from '~~/server/core/auth'
import { parseQuery, respond } from '../../../../utils/request'
import { paginationQuerySchema } from '../../../../utils/auth-schemas'
import { listRoles } from '../../../../utils/role-service'

/** 分页查询角色（含每个角色拥有的菜单 ID 列表）。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:role:read')
	if (!authorization.authorized) return authorization.response

	return respond(event, () => {
		const query = parseQuery(event, paginationQuerySchema)
		return listRoles(query)
	})
})
