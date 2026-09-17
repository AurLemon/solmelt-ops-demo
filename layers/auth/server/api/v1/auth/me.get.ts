import { authorizeRequest } from '~~/server/core/auth'
import { respond } from '../../../utils/request'
import { getCurrentUser } from '../../../utils/user-service'

/** 当前登录用户信息（JWT）。用户 ID 取自令牌 sub 声明。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event)
	if (!authorization.authorized) return authorization.response

	return respond(event, () => getCurrentUser(Number(authorization.claims.sub)))
})
