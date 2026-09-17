import { authorizeRequest } from '~~/server/core/auth'
import { parseBody, parseIdParam, respond } from '../../../../../utils/request'
import { resetPasswordSchema } from '../../../../../utils/auth-schemas'
import { resetUserPassword } from '../../../../../utils/user-service'

/** 管理员重置指定用户密码。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:user:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, async () => {
		const id = parseIdParam(event)
		const input = await parseBody(event, resetPasswordSchema)
		return resetUserPassword(id, input.password)
	})
})
