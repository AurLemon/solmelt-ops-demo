import type { LoginResult } from '~~/shared/contracts/auth'
import { issueAccessToken } from '~~/server/core/auth'
import { parseBody, respond } from '../../../utils/request'
import { loginInputSchema } from '../../../utils/auth-schemas'
import {
	captchaFailureMessage,
	consumeCaptcha,
	verifyCaptcha,
} from '../../../utils/captcha-service'
import { authenticateUser } from '../../../utils/user-service'
import { validationError } from '../../../utils/service-error'

/** 登录：校验验证码（成功登录后立即消费）与密码，签发 JWT。 */
export default defineEventHandler((event) => {
	return respond(event, async (): Promise<LoginResult> => {
		const input = await parseBody(event, loginInputSchema)

		const verification = await verifyCaptcha(input.captchaKey, input.captcha)
		if (!verification.ok) {
			throw validationError(captchaFailureMessage(verification.reason))
		}

		const user = await authenticateUser(input.username, input.password)

		await consumeCaptcha(input.captchaKey)
		const accessToken = await issueAccessToken({
			sub: user.id,
			username: user.username,
			role: user.role,
			permissions: user.permissions,
		})

		return { token: accessToken.token, expiresAt: accessToken.expiresAt, user }
	})
})
