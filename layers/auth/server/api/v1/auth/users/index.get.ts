import { authorizeRequest } from '~~/server/core/auth'
import { parseQuery, respond } from '../../../../utils/request'
import { userListQuerySchema } from '../../../../utils/auth-schemas'
import { listUsers } from '../../../../utils/user-service'

/** 分页查询用户（逻辑删除的用户不出现）。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:user:read')
	if (!authorization.authorized) return authorization.response

	return respond(event, () => {
		const query = parseQuery(event, userListQuerySchema)
		return listUsers(query)
	})
})
