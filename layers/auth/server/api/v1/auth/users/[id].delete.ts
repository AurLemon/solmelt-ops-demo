import { authorizeRequest } from '~~/server/core/auth'
import { parseIdParam, respond } from '../../../../utils/request'
import { deleteUser } from '../../../../utils/user-service'

/** 逻辑删除用户；不允许删除当前登录账号。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:user:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, () => deleteUser(parseIdParam(event), authorization.claims.sub))
})
