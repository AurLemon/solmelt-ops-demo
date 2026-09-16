import type { H3Event } from 'h3'
import { jwtVerify, SignJWT } from 'jose'
import type { ApiFailure } from '~~/shared/contracts/api'
import type { AuthClaims, PermissionCode } from '~~/shared/contracts/auth'
import { failure } from './http'

const ACCESS_TOKEN_TTL_SECONDS = 8 * 60 * 60

const permissionCodes = new Set<PermissionCode>([
	'system:user:read',
	'system:user:write',
	'system:role:read',
	'system:role:write',
	'device:read',
	'device:write',
	'telemetry:read',
	'alarm:read',
	'dashboard:read',
])

export interface AccessTokenResult {
	token: string
	expiresAt: string
}

export interface AuthorizedRequest {
	authorized: true
	claims: AuthClaims
}

export interface RejectedRequest {
	authorized: false
	response: ApiFailure
}

export type AuthorizationResult = AuthorizedRequest | RejectedRequest

function secretKey(): Uint8Array {
	return new TextEncoder().encode(useRuntimeConfig().jwtSecret)
}

function isAuthClaims(value: unknown): value is AuthClaims {
	if (typeof value !== 'object' || value === null) return false

	const claims = value as Record<string, unknown>
	return (
		typeof claims.sub === 'string' &&
		typeof claims.username === 'string' &&
		typeof claims.role === 'string' &&
		Array.isArray(claims.permissions) &&
		claims.permissions.every(
			(permission) =>
				typeof permission === 'string' && permissionCodes.has(permission as PermissionCode),
		)
	)
}

export async function issueAccessToken(claims: AuthClaims): Promise<AccessTokenResult> {
	const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1_000)
	const token = await new SignJWT({
		username: claims.username,
		role: claims.role,
		permissions: claims.permissions,
	})
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(claims.sub)
		.setIssuedAt()
		.setExpirationTime(Math.floor(expiresAt.getTime() / 1_000))
		.sign(secretKey())

	return { token, expiresAt: expiresAt.toISOString() }
}

export async function authorizeRequest(
	event: H3Event,
	requiredPermission?: PermissionCode,
): Promise<AuthorizationResult> {
	const authorization = getHeader(event, 'authorization')
	if (!authorization?.startsWith('Bearer ')) {
		return {
			authorized: false,
			response: failure(event, 401, 'UNAUTHENTICATED', '请先登录'),
		}
	}

	const token = authorization.slice('Bearer '.length).trim()
	if (!token) {
		return {
			authorized: false,
			response: failure(event, 401, 'UNAUTHENTICATED', '登录凭证无效或已过期'),
		}
	}

	try {
		const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
		if (!isAuthClaims(payload)) {
			return {
				authorized: false,
				response: failure(event, 401, 'UNAUTHENTICATED', '登录凭证无效或已过期'),
			}
		}

		if (requiredPermission && !payload.permissions.includes(requiredPermission)) {
			return {
				authorized: false,
				response: failure(event, 403, 'FORBIDDEN', '当前账号没有执行此操作的权限'),
			}
		}

		return { authorized: true, claims: payload }
	} catch {
		return {
			authorized: false,
			response: failure(event, 401, 'UNAUTHENTICATED', '登录凭证无效或已过期'),
		}
	}
}
