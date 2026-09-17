import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../services/api-support'
import { createDevice } from '../../../../services/device.service'
import { createDeviceSchema } from '../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:write')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, async () => {
		const input = parseWith(createDeviceSchema, await readBody(event))
		return createDevice(input)
	})
})
