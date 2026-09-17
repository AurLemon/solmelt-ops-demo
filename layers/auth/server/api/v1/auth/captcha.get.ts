import { createCaptchaChallenge } from '../../../utils/captcha-service'
import { respond } from '../../../utils/request'

/** 获取图形验证码：四位、五分钟过期，无需登录。 */
export default defineEventHandler((event) => {
	return respond(event, async () => createCaptchaChallenge())
})
