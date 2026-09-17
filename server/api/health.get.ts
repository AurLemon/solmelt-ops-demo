import { failure, success } from '../core/http'
import { usePrisma } from '../core/prisma'

export default defineEventHandler(async (event) => {
	const checkedAt = new Date().toISOString()

	try {
		await usePrisma().$queryRaw`SELECT 1`
		return success(event, {
			status: 'ok' as const,
			application: 'solmelt-ops',
			database: 'reachable' as const,
			checkedAt,
		})
	} catch {
		return failure(event, 503, 'DATABASE_UNAVAILABLE', '数据库暂时不可用', { checkedAt })
	}
})
