# 环境安装与故障处理

## 统一前提

所有成员必须安装 Git、Node.js 24.x、pnpm 11.24.0，并拥有 Gitee 私有仓库访问权限。开发工具推荐 VS Code；可使用 Codex、Claude Code、DeepSeek Harness 或其他具备文件读写与终端执行能力的 Agent，但 Agent 的登录、API Key 和本机权限由成员自行配置，绝不写入仓库。拿到组长发放的 Gitee clone URL 后，先按 `docs/cowork-guide.md` 克隆并进入仓库目录，再执行下列检查。

```bash
node -v
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm -v
git --version
```

Node.js 使用官网的 24 LTS 安装包。pnpm 11 与 Node 24 兼容；仓库通过 `packageManager` 固定 pnpm 11.24.0。不要用 npm 或 yarn 安装本项目依赖。

若 `corepack enable` 后仍找不到 `pnpm`，先重新打开终端并确认 `node -v` 是 24.x；仍失败时，按 pnpm 官方“指定版本安装”方式安装 **11.24.0**，不要无版本安装最新版 pnpm。安装完成后再运行 `pnpm env:check`。

## 标准数据库路径：Docker Compose

Docker Desktop 是所有成员的推荐路径。Compose 会自动拉取 `mysql:8.4`，无需先执行 `docker pull`。

### 配置归属与团队同步

仓库提交的 `.env.example` 由组长维护，只保存可公开的本地开发默认值；每位成员都必须在自己电脑上复制为 `.env`，并只在本机设置 `JWT_SECRET`。`.env`、数据库密码、Docker 数据卷和 Seed 后的数据均不得提交或在成员之间传输。

四个领域使用各自电脑上的同一套 Docker Compose 数据库，不共享某一位成员的 MySQL 实例。数据库负责人可以提交 Prisma Schema、migration、Seed 或 Docker 配置的代码变更；其他成员拉取这些代码后，在本机重新执行迁移、Seed 和状态检查即可。数据库业务实现尚未完成时，不影响成员先完成通用环境安装。

```bash
cp .env.example .env
# 生成随机值后，手动替换 .env 中的 JWT_SECRET
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
pnpm env:check
pnpm install --frozen-lockfile
docker compose config --quiet
docker compose up -d --wait
docker compose ps
docker compose exec -T mysql sh -c 'mysqladmin ping -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" --silent'
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:migrate:status
```

如果本机 Docker Compose 不支持 `--wait`，先执行 `docker compose up -d`，再以 `docker compose ps` 确认 `mysql` 服务为 `healthy`，最后执行迁移。不得在数据库健康前反复执行迁移或删除数据卷。

Compose 的初始化脚本只会在空数据卷第一次初始化时执行；容器显示 `healthy` 只代表 MySQL 可连接，不代表已有数据卷中的账号、密码和 shadow database 权限已同步。遇到账号或权限异常时先查看 `docker compose logs mysql` 和 `.env`，不要直接执行 `docker compose down -v`。

### macOS

安装与本机芯片匹配的 Docker Desktop：Apple Silicon 使用 Apple Silicon 安装包，Intel 使用 Intel 安装包。启动 Docker Desktop 并接受许可后验证：

```bash
node -v
pnpm -v
docker compose version
```

### Windows

先安装 Node.js 24 LTS，再安装或更新 WSL 2，开启 BIOS/UEFI 虚拟化，最后安装 Docker Desktop 并使用 Linux containers backend。

```powershell
wsl --install
wsl --update
node -v
pnpm -v
docker compose version
```

如果 Docker Desktop 无法启动，先检查 WSL 2、虚拟化和 Desktop 状态，不要重复初始化数据库卷。

## Docker 不可用时：原生 MySQL 8.4

原生 MySQL 8.4 是正式兜底，不是并行开发环境。切换前先执行 `docker compose ps` 确认 Docker 实例；如果仍运行且原生 MySQL 使用 3306，请先执行 `docker compose stop mysql`，再启动原生服务。也可以让其中一个实例使用 3307，但必须同步修改连接配置，并用 `nc -z 127.0.0.1 <port>` 验证目标端口。使用官网安装包完成服务启动后，由数据库拥有者执行：

```sql
CREATE DATABASE solmelt_ops CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'solmelt'@'localhost' IDENTIFIED BY 'solmelt_dev';
CREATE USER 'solmelt'@'127.0.0.1' IDENTIFIED BY 'solmelt_dev';
GRANT ALL PRIVILEGES ON solmelt_ops.* TO 'solmelt'@'localhost';
GRANT ALL PRIVILEGES ON solmelt_ops.* TO 'solmelt'@'127.0.0.1';
FLUSH PRIVILEGES;
```

将 `.env` 的 `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_USER`、`DATABASE_PASSWORD` 和 `DATABASE_NAME` 改为本机实际值；同时必须把 Prisma migration 使用的 `DATABASE_URL` 改成完全相同的连接目标。例如：

```dotenv
DATABASE_URL="mysql://solmelt:solmelt_dev@127.0.0.1:3307/solmelt_ops"
DATABASE_HOST="127.0.0.1"
DATABASE_PORT="3307"
DATABASE_USER="solmelt"
DATABASE_PASSWORD="solmelt_dev"
DATABASE_NAME="solmelt_ops"
```

`DATABASE_URL` 与拆分变量不一致时，不要执行迁移或 Seed；Prisma migration 读取 `DATABASE_URL`，应用和 Seed 读取拆分变量。

然后执行：

```bash
pnpm db:migrate:deploy
pnpm db:seed
```

只有负责 Contract Change 的组长需要 `pnpm db:migrate:dev`。该命令会创建临时 shadow database，因此额外需要对本地开发账号授予全局开发权限；普通组员不应执行此命令：

```sql
GRANT CREATE, DROP, ALTER, REFERENCES ON *.* TO 'solmelt'@'localhost';
GRANT CREATE, DROP, ALTER, REFERENCES ON *.* TO 'solmelt'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## Python：仅采集组

`feat/telemetry` 的两位成员准备 Python 3.11+ 与 `requests`。其他成员不需要为了本项目安装 Python。模拟器脚本落地后，其依赖以 `scripts/simulator/` 的说明为准。采集组在该目录创建本项目专用虚拟环境，不把 requests 装到系统 Python，也不提交 `.venv`：

```bash
cd scripts/simulator
python3 -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell（另开终端时使用）
# .\.venv\Scripts\Activate.ps1
python -m pip install requests
python -c "import requests; print(requests.__version__)"
```

## 下载慢与代理

只允许比较以下两个 npm registry，禁止让 AI 自行搜索或使用未知镜像：

- 官方：`https://registry.npmjs.org/`
- 国内候选：`https://registry.npmmirror.com/`

先读取当前值，再分别测速。仅当国内候选明显更快且请求正常时，才持久切换对应工具的 user-level registry；必须记录原值、最终值和回滚命令。项目依赖只用 pnpm 安装，但同时设置 npm 是为了成员执行 Corepack 或排查时行为一致。

```bash
pnpm config get registry
npm config get registry
pnpm ping --registry=https://registry.npmjs.org/
pnpm ping --registry=https://registry.npmmirror.com/

# 仅测速确认后执行二选一；这两条会持久修改当前用户配置
pnpm config set registry https://registry.npmmirror.com/
npm config set registry https://registry.npmmirror.com/

# 回滚到官方源
pnpm config set registry https://registry.npmjs.org/
npm config set registry https://registry.npmjs.org/
```

Node.js 安装包仍使用官网。Docker 镜像拉取由 Docker daemon 处理：Docker Desktop 的代理必须在 Desktop 设置中确认，不能假设终端临时代理对镜像拉取生效。

若检测到 Clash Verge、Clash Meta 等本地代理，只可读取已配置的 HTTP 端口；需要临时代理时仅为单个命令设置：

```bash
HTTP_PROXY=http://127.0.0.1:<port> HTTPS_PROXY=http://127.0.0.1:<port> NO_PROXY=localhost,127.0.0.1 <command>
```

不得将代理变量写入 shell 配置、`.env`、Docker 配置或仓库文件。

## Agent 启动

仓库内的 [Agent 入门](agent-quickstart.md) 是所有 Agent 的统一入口。不同工具和版本的指令文件加载行为可能变化：Codex、Claude Code、DeepSeek Harness 在当前配置下分别使用 `AGENTS.md` 或根 `CLAUDE.md`；不确定时必须以工具文档和首次只读确认结果为准，并粘贴该文档提供的通用提示词。任何 Agent 首次进入仓库时，都应先完成只读边界确认，再获得修改授权。
