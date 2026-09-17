import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../../services/api-support'
import { listProductProperties } from '../../../../../services/device.service'
import { productIdParamSchema } from '../../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:read')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, () => {
		const productId = parseWith(productIdParamSchema, getRouterParam(event, 'id'))
		return listProductProperties(productId)
	})
})
