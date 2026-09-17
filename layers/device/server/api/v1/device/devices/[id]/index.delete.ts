import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../../services/api-support'
import { deleteDevice } from '../../../../../services/device.service'
import { deviceIdParamSchema } from '../../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:write')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, () => {
		const deviceId = parseWith(deviceIdParamSchema, getRouterParam(event, 'id'))
		return deleteDevice(deviceId)
	})
})
