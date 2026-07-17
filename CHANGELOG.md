# Changelog

## [Unreleased]

### 1.0.0 — 团队待办清单 MVP

**基础设施**
- Next.js 15 App Router + React Server Components
- TypeScript 严格模式
- Tailwind CSS + shadcn/ui 组件库
- PostgreSQL + Prisma ORM 数据持久化
- NextAuth.js v5 邮箱密码认证
- Docker Compose 一键部署
- pnpm 包管理

**账号与认证**
- 邮箱 + 密码注册与登录
- NextAuth.js Session 管理
- CSRF 保护

**清单管理**
- 创建清单（成员自动成为创建者）
- 编辑清单名称与描述
- 删除清单（仅创建者）

**权限系统**
- 三级角色：创建者 / 管理者 / 参与者
- 应用层中间件校验（Next.js Middleware + API Route Guards）
- 创建者可转让创建者角色、修改成员角色
- 管理者可添加/移除成员、管理任务
- 参与者仅操作自己负责的任务
- 无权限操作统一返回 403

**任务管理**
- 任务 CRUD
- 固定三态：待办 → 进行中 → 已完成
- 优先级：高 / 中 / 低
- 截止日期
- 指派负责人
- 排序：优先级 / 截止日期 / 创建时间
- 筛选：按状态、按指派人、「只看我的」
- 标题关键词搜索

**成员管理**
- 组合搜索（用户名 / 显示名 / 邮箱）添加成员
- 实时成员列表

**UI / UX**
- 响应式布局（桌面 / 平板 / 手机）
- 仪表盘（所有参与清单概览）
- 清单详情页（任务列表 + 成员面板）
- 暗色模式
