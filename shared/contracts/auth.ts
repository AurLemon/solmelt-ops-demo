/** 由 Seed 创建且前端可识别的内置角色。 */
export type BuiltInRoleCode = 'ADMIN' | 'OPERATOR'

/**
 * 角色管理允许新增角色，因此 API 与 JWT 不能把角色码限制为两种内置值。
 * 业务权限始终由 permissions 决定，不能仅依据角色码判断。
 */
export type RoleCode = string

export type PermissionCode =
	| 'system:user:read'
	| 'system:user:write'
	| 'system:role:read'
	| 'system:role:write'
	| 'device:read'
	| 'device:write'
	| 'telemetry:read'
	| 'alarm:read'
	| 'alarm:handle'
	| 'dashboard:read'

export interface AuthClaims {
	sub: string
	username: string
	role: RoleCode
	permissions: PermissionCode[]
}

export interface CaptchaChallenge {
	key: string
	imageBase64: string
	expiresAt: string
}

export interface LoginInput {
	username: string
	password: string
	captcha: string
	captchaKey: string
}

export interface AuthenticatedUser {
	id: string
	username: string
	displayName: string
	role: RoleCode
	permissions: PermissionCode[]
}

export interface LoginResult {
	token: string
	expiresAt: string
	user: AuthenticatedUser
}
