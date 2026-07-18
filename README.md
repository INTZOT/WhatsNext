# WhatsNext

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

团队协作待办清单 — 多清单管理 · 三级权限 · 看板 · 子任务 · 标签 · Docker 一键部署

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 数据库 | PostgreSQL + Prisma ORM |
| 认证 | NextAuth.js v5 (邮箱密码) |
| 部署 | Docker Compose / 原生 Node.js |
| 包管理 | pnpm |

## 功能

- **多清单管理** — 独立清单，独立权限，独立标签
- **三级权限** — 创建者 / 管理者 / 参与者
- **看板视图** — 三列看板，列表/看板一键切换
- **子任务** — 嵌套折叠，完成级联
- **标签系统** — 内联创建，支持筛选
- **任务详情** — 完整属性编辑，描述，子任务管理
- **加入/退出** — ID 分享加入，一键退出
- **暗色模式** — 自动跟随系统

## 权限模型

| 操作 | 创建者 | 管理者 | 参与者 |
|------|:---:|:---:|:---:|
| 删除清单 | ✅ | ❌ | ❌ |
| 修改清单 | ✅ | ✅ | ❌ |
| 管理成员 | ✅ | ✅ | ❌ |
| 编辑/删除任务 | ✅ | ✅ | ❌ |
| 创建任务 | ✅ | ✅ | ✅ |
| 切换状态 | ✅ | ✅ | ✅ |
| 退出清单 | ❌ | ✅ | ✅ |

---

## 部署

### Docker Compose

```bash
git clone https://github.com/INTZOT/WhatsNext.git && cd WhatsNext

# 生成 AUTH_SECRET
openssl rand -base64 32
# Windows: powershell -Command "-join ((48..57)+(65..90)+(97..122)|Get-Random -Count 32|%{[char]$_})"

# 创建 .env（替换下面尖括号内容）
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:postgres@db:5432/whatsnext"
AUTH_SECRET=你生成的密钥
AUTH_URL=http://你的IP:3000
EOF

# 启动
docker compose up -d
```

### 本地部署

**前提**：Node.js 22+、PostgreSQL 16+、pnpm

```bash
git clone https://github.com/INTZOT/WhatsNext.git && cd WhatsNext
pnpm install

# 创建数据库
createdb whatsnext
# Windows: pgAdmin → Databases → Create → whatsnext

# 配置 .env
cp .env.example .env
# 编辑 DATABASE_URL 指向本地 PostgreSQL

# 迁移 + 构建 + 启动
pnpm prisma:generate
pnpm prisma:migrate dev --name init
pnpm build
pnpm start
```

开发模式（热更新）：`pnpm dev`

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `AUTH_SECRET` | 加密密钥 (`openssl rand -base64 32`) |
| `AUTH_URL` | 站点地址 (`http://ip:3000`) |

## License

MIT
