import { authorizeRequest } from '~~/server/core/auth'
import { parseBody, respond } from '../../../../utils/request'
import { createUserSchema } from '../../../../utils/auth-schemas'
import { createUser } from '../../../../utils/user-service'

/** 创建用户：密码仅保存 bcrypt 哈希，用户名唯一。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:user:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, async () => {
		const input = await parseBody(event, createUserSchema)
		return createUser(input)
	})
})
