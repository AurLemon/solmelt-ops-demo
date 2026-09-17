import { authorizeRequest } from '~~/server/core/auth'
import { respond } from '../../../utils/request'
import { getMenuTreeForRole } from '../../../utils/menu-service'
/** 当前登录角色拥有的菜单树（导航 + 角色维护页选择）。 */
export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event)
	if (!authorization.authorized) return authorization.response

	return respond(event, () => getMenuTreeForRole(authorization.claims.role))
})
