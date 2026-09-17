import { authorizeRequest } from '~~/server/core/auth'
import { ServiceError, handleDeviceApi, parseWith } from '../../../../../services/api-support'
import { importProductProperties } from '../../../../../services/device.service'
import {
	deviceModelPayloadSchema,
	productIdParamSchema,
} from '../../../../../services/device-schemas'

export default defineEventHandler(async (event) => {
	const authorization = await authorizeRequest(event, 'device:write')
	if (!authorization.authorized) return authorization.response

	return handleDeviceApi(event, async () => {
		const productId = parseWith(productIdParamSchema, getRouterParam(event, 'id'))
		const filePart = (await readMultipartFormData(event))?.find((part) => part.name === 'file')
		if (!filePart) {
			throw new ServiceError(400, 'VALIDATION_ERROR', '请上传名为 file 的物模型 JSON 文件')
		}

		let payload: unknown
		try {
			payload = JSON.parse(new TextDecoder().decode(filePart.data))
		} catch {
			throw new ServiceError(400, 'VALIDATION_ERROR', '物模型文件不是合法的 JSON')
		}
		return importProductProperties(productId, parseWith(deviceModelPayloadSchema, payload))
	})
})
