import { authorizeRequest } from '~~/server/core/auth'
import { parseIdParam, respond } from '../../../../utils/request'
import { deleteRole } from '../../../../utils/role-service'

/** 物理删除角色；角色仍被用户关联时返回 409。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:role:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, () => deleteRole(parseIdParam(event)))
})
