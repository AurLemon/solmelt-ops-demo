import { authorizeRequest } from '~~/server/core/auth'
import { parseBody, parseIdParam, respond } from '../../../../utils/request'
import { updateUserSchema } from '../../../../utils/auth-schemas'
import { updateUser } from '../../../../utils/user-service'

/** 更新用户基础信息（显示名、角色、状态）；用户名与密码不在本接口修改。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:user:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, async () => {
		const id = parseIdParam(event)
		const input = await parseBody(event, updateUserSchema)
		return updateUser(id, input)
	})
})
