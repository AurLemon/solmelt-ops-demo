import { authorizeRequest } from '~~/server/core/auth'
import { parseBody, respond } from '../../../../utils/request'
import { createRoleSchema } from '../../../../utils/auth-schemas'
import { createRole } from '../../../../utils/role-service'

/** 创建角色：编码唯一，menuIds 建立角色-菜单授权。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:role:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, async () => {
		const input = await parseBody(event, createRoleSchema)
		return createRole(input)
	})
})
