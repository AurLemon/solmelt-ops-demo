import { randomUUID } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import svgCaptcha from 'svg-captcha'
import type { CaptchaChallenge } from '~~/shared/contracts/auth'
import { usePrisma } from '~~/server/core/prisma'

const CAPTCHA_TTL_MS = 5 * 60 * 1_000
const CAPTCHA_HASH_COST = 10

/** 生成四位图形验证码并入库，五分钟过期。 */
export async function createCaptchaChallenge(): Promise<CaptchaChallenge> {
	const challenge = svgCaptcha.create({
		size: 4,
		ignoreChars: 'il1IO0',
		noise: 2,
		color: true,
		background: '#f1f5f9',
	})
	const key = randomUUID().replaceAll('-', '')
	const expiresAt = new Date(Date.now() + CAPTCHA_TTL_MS)

	// 顺带清理已过期记录，避免验证码表无限增长。
	await usePrisma().captcha.deleteMany({ where: { expiresAt: { lt: new Date() } } })
	await usePrisma().captcha.create({
		data: {
			key,
			answerHash: await hash(challenge.text.toLowerCase(), CAPTCHA_HASH_COST),
			expiresAt,
		},
	})

	return {
		key,
		imageBase64: `data:image/svg+xml;base64,${Buffer.from(challenge.data).toString('base64')}`,
		expiresAt: expiresAt.toISOString(),
	}
}

export type CaptchaVerification =
	{ ok: true } | { ok: false; reason: 'NOT_FOUND' | 'CONSUMED' | 'EXPIRED' | 'MISMATCH' }

/** 校验验证码：存在、未过期、未消费且答案匹配。是否消费由调用方决定。 */
export async function verifyCaptcha(key: string, answer: string): Promise<CaptchaVerification> {
	const record = await usePrisma().captcha.findUnique({ where: { key } })
	if (!record) return { ok: false, reason: 'NOT_FOUND' }
	if (record.consumedAt) return { ok: false, reason: 'CONSUMED' }
	if (record.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'EXPIRED' }

	const matches = await compare(answer.toLowerCase(), record.answerHash)
	return matches ? { ok: true } : { ok: false, reason: 'MISMATCH' }
}

/** 消费验证码（成功登录后调用），保证一次性使用。 */
export async function consumeCaptcha(key: string): Promise<void> {
	await usePrisma().captcha.update({ where: { key }, data: { consumedAt: new Date() } })
}

const captchaFailureMessages = {
	NOT_FOUND: '验证码不存在或已失效，请刷新后重试',
	CONSUMED: '验证码已被使用，请刷新后重试',
	EXPIRED: '验证码已过期，请刷新后重试',
	MISMATCH: '验证码错误',
} as const

export function captchaFailureMessage(reason: keyof typeof captchaFailureMessages): string {
	return captchaFailureMessages[reason]
}
