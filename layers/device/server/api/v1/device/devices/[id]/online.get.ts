import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../../services/api-support'
import { getDeviceOnline } from '../../../../../services/device.service'
import { deviceIdParamSchema } from '../../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:read')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, () => {
		const deviceId = parseWith(deviceIdParamSchema, getRouterParam(event, 'id'))
		return getDeviceOnline(deviceId)
	})
})
