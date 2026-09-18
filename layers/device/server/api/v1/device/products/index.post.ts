import { authorizeRequest } from '~~/server/core/auth'
import { handleDeviceApi, parseWith } from '../../../../services/api-support'
import { createProduct } from '../../../../services/device.service'
import { createProductSchema } from '../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:write')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, async () => {
		const input = parseWith(createProductSchema, await readBody(event))
		return createProduct({
			identifier: input.identifier,
			name: input.name,
			...(input.remark !== undefined ? { remark: input.remark } : {}),
		})
	})
})
