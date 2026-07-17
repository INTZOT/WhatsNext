# Whatsnext

团队协作待办清单，支持三级权限管理与 Docker 一键部署。

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 15 (App Router + RSC) |
| 语言 | TypeScript (Strict Mode) |
| 样式 | Tailwind CSS + shadcn/ui |
| 数据库 | PostgreSQL + Prisma ORM |
| 认证 | NextAuth.js v5 (邮箱密码登录) |
| 部署 | Docker Compose 一行部署 |
| 包管理 | pnpm |

## V1 功能

- **多清单管理** — 创建多个独立待办清单，每个清单独立管理成员与权限
- **三级权限** — 创建者（完全控制）/ 管理者（管理任务与成员）/ 参与者（操作自己负责的任务）
- **任务操作** — CRUD + 固定三态（待办/进行中/已完成）+ 优先级（高/中/低）+ 截止日期 + 指派负责人
- **智能筛选** — 按状态筛选、按优先级/截止日期排序、「只看我的」一键切换、标题搜索
- **成员管理** — 组合搜索（用户名/显示名/邮箱）添加成员，实时分配角色
- **响应式布局** — 桌面/平板/手机全适配

## 快速部署

```bash
# 1. 克隆并进入项目
git clone <repo-url> && cd Whatsnext

# 2. 一键启动（需已安装 Docker 和 Docker Compose）
docker compose up -d

# 3. 访问 http://localhost:3000
```

首次启动会自动执行数据库迁移。默认不创建管理员账户，请通过注册页面创建第一个用户。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:postgres@db:5432/whatsnext` |
| `AUTH_SECRET` | NextAuth 密钥 | 随机生成（生产环境请固定） |
| `AUTH_URL` | 站点地址 | `http://localhost:3000` |

## 权限模型

| 操作 | 创建者 | 管理者 | 参与者 |
|------|--------|--------|--------|
| 删除清单 | ✅ | ❌ | ❌ |
| 修改清单名称/描述 | ✅ | ✅ | ❌ |
| 添加/移除成员 | ✅ | ✅ | ❌ |
| 修改成员角色 | ✅ | ❌ | ❌ |
| 创建任务 | ✅ | ✅ | ✅ |
| 编辑任务 | ✅ | ✅ | ✅（仅自己负责的） |
| 删除任务 | ✅ | ✅ | ❌ |
| 修改任务状态 | ✅ | ✅ | ✅（仅自己负责的） |
| 指派负责人 | ✅ | ✅ | ❌ |

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发数据库（仅 DB 容器）
docker compose up db -d

# 同步数据库迁移
pnpm prisma:migrate

# 启动开发服务器
pnpm dev

# 打开浏览器
open http://localhost:3000
```

## License

MIT
