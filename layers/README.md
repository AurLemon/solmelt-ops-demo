# 领域 Layer

用途：按 Auth、Device、Telemetry、Dashboard 划分的 Nuxt Layer。每组只维护自己的目录和固定 feat 分支。

允许：本领域页面、API、组件和 Service。禁止：跨 Layer 私有导入、公共契约修改或跨领域写表。

开始前阅读根 `AGENTS.md`、本 Layer 的 `AGENTS.md` 和 `docs/ai/` 对应说明。
