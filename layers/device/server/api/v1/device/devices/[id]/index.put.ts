import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../../services/api-support'
import { updateDevice } from '../../../../../services/device.service'
import { deviceIdParamSchema, updateDeviceSchema } from '../../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:write')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, async () => {
		const deviceId = parseWith(deviceIdParamSchema, getRouterParam(event, 'id'))
		const input = parseWith(updateDeviceSchema, await readBody(event))
		return updateDevice(deviceId, input)
	})
})
