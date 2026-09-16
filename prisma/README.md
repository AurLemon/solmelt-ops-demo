# Prisma 数据库层

用途：多文件 Schema、冻结迁移和真实物模型 Seed。组长维护。

允许：经组长确认后在 `main` 修改 Schema、生成迁移和更新 Seed。禁止：业务分支直接生成 migration、手写生产 SQL 或改写老师物模型数据。

相关命令：`pnpm db:validate`、`pnpm db:migrate:deploy`、`pnpm db:seed`。
