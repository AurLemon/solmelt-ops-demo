import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../services/api-support'
import { listDevices } from '../../../../services/device.service'
import { deviceListQuerySchema } from '../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:read')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, () => {
		const query = parseWith(deviceListQuerySchema, getQuery(event))
		return listDevices({
			page: query.page,
			pageSize: query.pageSize,
			...(query.keyword ? { keyword: query.keyword } : {}),
			...(query.status ? { status: query.status } : {}),
			...(query.productId !== undefined ? { productId: query.productId } : {}),
		})
	})
})
