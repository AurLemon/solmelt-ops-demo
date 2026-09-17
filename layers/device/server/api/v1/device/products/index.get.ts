import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi } from '../../../../services/api-support'
import { listProducts } from '../../../../services/device.service'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:read')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, () => listProducts())
})
