import { authorizeRequest } from '~~/server/core/auth'
import { parseBody, parseIdParam, respond } from '../../../../utils/request'
import { updateRoleSchema } from '../../../../utils/auth-schemas'
import { updateRole } from '../../../../utils/role-service'

/** 更新角色名、备注并整体替换角色-菜单授权。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'system:role:write')
	if (!authorization.authorized) return authorization.response

	return respond(event, async () => {
		const id = parseIdParam(event)
		const input = await parseBody(event, updateRoleSchema)
		return updateRole(id, input)
	})
})
