# 服务端核心能力

用途：Prisma 连接、Typed EventBus、统一响应与错误处理，以及 JWT 签发和受保护接口的公共鉴权边界。组长维护。

允许：跨领域通用且无业务规则的能力。禁止：领域数据库逻辑、页面状态或某组私有 Service。

`auth.ts` 固定签发 8 小时 HS256 Token，并以 `authorizeRequest` 返回 `authorized: true/false` 的显式判别联合。业务 Layer 只能消费该结果与公共权限码，不得再次解析 JWT 或复制一套鉴权规则。
