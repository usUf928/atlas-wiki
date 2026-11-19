# Atlas Wiki

一座可自托管、可 Docker 部署的深色系中文 Wiki。项目代号 **Atlas Wiki**，标志为自创的四格几何标记（三个实心圆角方块 + 一个描边方块），与任何现有品牌无关。

- 前端：React 18 + TypeScript + Vite + React Router v6 + Tailwind CSS + TanStack Query
- 渲染：react-markdown + remark-gfm + rehype-sanitize + Shiki（自定义低饱和主题）
- 后端：Node.js 20 + Express + TypeScript + Prisma
- 数据库：开发期 SQLite，生产期 PostgreSQL（同一份 schema，由 `DATABASE_PROVIDER` 切换）
- 认证：JWT（access 15 分钟 + refresh 7 天，均存 httpOnly Cookie）、图形验证码、登录锁定、CSRF 双提交
- 部署：`docker-compose.yml`（web + api + db）

---

## 一、一键启动（Docker）

需要 Docker 24+ 与 Docker Compose v2。

```bash
cp .env.example .env          # 可选：不复制也能用默认值启动
docker compose up -d --build
```

首次构建会安装依赖、编译前后端、同步数据库并写入种子数据，通常需要 3–8 分钟。完成后打开：

```
http://localhost:8080
```

健康检查：

```bash
curl http://localhost:8080/api/site/health
```

停止与清理：

```bash
docker compose down            # 保留数据卷
docker compose down -v         # 连数据库与上传文件一起删除
```

### 种子账号

| 角色 | 用户名 | 初始密码 | 说明 |
|---|---|---|---|
| 管理员 | `admin` | `Admin@12345` | 首次登录强制修改密码 |
| 编辑者 | `editor` | `Editor@12345` | 可直接发布、审核、回滚 |
| 注册用户 | `wanderer` | `User@12345` | 新建/编辑进入待审队列 |

游客入口不需要账号：直接访问站点即可只读浏览；登录页提供「以游客身份继续」。

> 生产或公网部署前必须修改 `.env` 里的 `POSTGRES_PASSWORD`、`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET`、`CSRF_SECRET`，并修改初始账号密码。暗网部署见 [docs/onion.md](docs/onion.md)。

---

## 二、本地开发（不使用 Docker）

```bash
# 1. 依赖（pnpm 9）
pnpm install

# 2. 环境变量
cp .env.example .env
# Prisma CLI 只读取 schema 同目录/项目目录的 .env，本地开发再放一份 DATABASE_URL：
printf 'DATABASE_URL="file:./dev.db"\n' > apps/api/.env

# 3. 构建共享包（Zod schema / 类型 / diff 工具）
pnpm --filter @atlas/shared build

# 4. SQLite 建表 + 种子
pnpm db:push
pnpm db:seed

# 5. 同时启动 api（4000）与 web（5173）
pnpm dev
```

打开 `http://localhost:5173`。Vite 会把 `/api` 与 `/uploads` 代理到 `http://localhost:4000`。

单独启动：

```bash
pnpm --filter @atlas/api dev
pnpm --filter @atlas/web dev
```

数据库重置：

```bash
rm apps/api/prisma/dev.db
pnpm db:push && pnpm db:seed
```

### SQLite / PostgreSQL 切换

`apps/api/prisma/schema.prisma` 是唯一 schema。`apps/api/scripts/set-provider.mjs` 会根据 `DATABASE_PROVIDER` 改写 datasource 的 provider（`sqlite` / `postgresql`），然后执行 `prisma db push`。Docker 构建阶段固定为 `postgresql`。

字段类型刻意保持两端兼容：枚举用 `String`（应用层 Zod 校验），`AuditLog.detail` 用 JSON 字符串存储。

---

## 三、目录结构

```
atlas-wiki/
├─ apps/
│  ├─ web/                 React 前端
│  │  ├─ public/media/     原创 SVG 示意图
│  │  ├─ src/components/   Layout / Header / Markdown / 编辑器 / 目录树 / 评论
│  │  ├─ src/pages/        首页、条目、历史、编辑、搜索、后台…
│  │  ├─ src/lib/          API 客户端、鉴权、Markdown 管线、Shiki 主题
│  │  └─ nginx.conf        生产环境静态服务与反向代理
│  └─ api/                 Express API
│     ├─ prisma/           schema、种子数据、原创条目内容
│     ├─ src/middleware/   鉴权、CSRF、限流、校验、错误
│     ├─ src/routes/       auth / pages / comments / categories / admin / upload / users / site
│     ├─ src/lib/          JWT、密码、验证码、审计、diff、slug
│     └─ Dockerfile
├─ packages/shared/        前后端共享 Zod schema、类型、diff、slug、摘要工具
├─ docs/onion.md           暗网（Tor Onion Service）部署说明书
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

---

## 四、设计系统

### 色板（唯一来源：`apps/web/src/styles/index.css`）

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg-sunken` | `#08090A` | 页面最底层、代码块 |
| `--bg-base` | `#0D0E10` | 主内容区 |
| `--bg-raised` | `#141619` | 卡片、侧栏、表头、斑马纹 |
| `--bg-overlay` | `#1A1D21` | 弹窗、下拉、Tooltip |
| `--border-subtle` | `#23262B` | 1px 分隔线 |
| `--border-strong` | `#33383F` | 输入框、按钮描边 |
| `--text-primary` | `#C4C8CE` | 正文（替代纯白） |
| `--text-secondary` | `#8A9099` | 次要文字 |
| `--text-tertiary` | `#5A606A` | 元信息、时间戳 |
| `--text-disabled` | `#3E434A` | 禁用态 |
| `--link` | `#8FA3B3` | 链接 |
| `--accent` | `#7A8B99` | 主强调色（低饱和青灰） |
| `--accent-muted` | `rgba(122,139,153,.12)` | 选中行、当前项 |
| `--danger` | `#8C5A5A` | 删除、错误 |
| `--warn` | `#8C7A4F` | 警告 |
| `--success` | `#5A7A62` | 成功 |

全站没有 `#FFFFFF`，没有高饱和色、发光或玻璃拟态。Tailwind 只把颜色映射到这些变量（`bg-base`、`text-primary` 等），组件内不写死色值。

### 视觉规则

- 圆角 4–6px；层次靠 1px 边框 + 背景明度差；阴影仅 `0 1px 2px rgba(0,0,0,.4)`
- 字号阶梯 12 / 13 / 14 / 16 / 18 / 22 / 28，行高 1.65
- 正文最大宽度 760px，中文段落不缩进，段间距 1em
- 字体：Inter、Noto Sans SC（正文），Source Serif 4（标题），JetBrains Mono（代码），全部通过 `@fontsource` 本地打包，无商业字体 CDN
- 图标统一 Lucide，无品牌图标
- 深色一致性：`color-scheme: dark`、滚动条、选中文本、表单控件、autofill 均已适配

界面截图（首页、条目页、375px 移动端、登录、后台）见 [docs/screenshots.md](docs/screenshots.md)。

### Logo

`apps/web/src/components/Logo.tsx`：2×2 网格中三个实心圆角方块 + 一个描边方块，纯几何构成；favicon 使用同一图形。与任何已知品牌标识无关联。

---

## 五、角色与权限

| 能力 | 游客 | 注册用户 | 编辑者 | 管理员 |
|---|---|---|---|---|
| 浏览 / 搜索 / 历史 / 差异 | ✅ | ✅ | ✅ | ✅ |
| 评论 | ❌ | ✅ | ✅ | ✅ |
| 创建页面 | ❌ | 提交待审 | 直接发布 | 直接发布 |
| 编辑他人页面 | ❌ | ❌ | ✅ | ✅ |
| 编辑受保护页面 | ❌ | ❌ | ✅ | ✅ |
| 删除页面（软删除） | ❌ | ❌ | ❌ | ✅ |
| 回滚版本 | ❌ | ❌ | ✅ | ✅ |
| 审核队列 | ❌ | ❌ | ✅ | ✅ |
| 用户管理 / 改角色 / 封禁 | ❌ | ❌ | ❌ | ✅ |
| 分类 / 站点设置 / 审计日志 | ❌ | ❌ | ❌ | ✅ |

服务端为准：每个写接口都在路由内调用 `requireAuth` / `requireEditor` / `requireAdmin`；前端隐藏按钮只是体验优化。

---

## 六、认证与验证码

- **注册**：用户名 4–20 位字母数字下划线，邮箱唯一，密码 ≥8 位含大小写与数字；验证码 → 字段格式 → 唯一性 → 落库。任何失败统一返回「注册信息有误，请检查后重试」，真实原因只写服务端日志，避免账号枚举。
- **验证码**：`svg-captcha` 生成 4 位 SVG，答案小写存库，5 分钟过期，校验后无论对错立即销毁（`consumed=true` 原子更新），绑定 IP，同一 IP 每分钟最多 10 次。前端 `<img>` 展示，点击可刷新。
- **登录**：用户名或邮箱 + 密码 + 验证码；连续 5 次失败锁定 15 分钟；同一 IP 每分钟最多 10 次；成功后记录 `lastLoginAt` / `lastLoginIp`。
- **JWT**：access 15 分钟、refresh 7 天，均 httpOnly Cookie；refresh token 哈希存库，刷新时轮换并吊销旧 token；退出登录清除 Cookie 并吊销。
- **CSRF**：SameSite=Lax + 双提交 Token（`atlas_csrf` 可读 Cookie + `X-CSRF-Token` 请求头，HMAC 签名校验），所有非 GET 接口强制校验。
- **强制改密**：种子管理员或管理员重置密码后 `mustChangePassword=true`，前端弹出不可关闭的改密弹窗。
- **邮箱验证码**：`POST /api/auth/email-code` 预留接口，开发环境把验证码打印到控制台并随响应返回 `devHint`。

---

## 七、API 一览

统一前缀 `/api`，响应结构 `{ code, data, message }`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/auth/csrf` | 下发 CSRF Token |
| GET | `/auth/captcha` | `{ captchaId, svg }` |
| POST | `/auth/register` / `login` / `logout` / `refresh` | 认证 |
| GET | `/auth/me` | 当前用户或 null |
| POST | `/auth/change-password` | 修改密码 |
| POST | `/auth/email-code` | 预留邮箱验证码 |
| GET | `/pages` | 分页 / 分类 / 标签 / 排序 |
| GET | `/pages/index` | 全量 slug+title（内链解析） |
| GET | `/pages/:slug` | 条目详情 |
| POST / PUT / DELETE | `/pages`、`/pages/:slug` | 创建 / 更新 / 软删除 |
| GET | `/pages/:slug/revisions`、`/revisions/:v` | 历史 |
| GET | `/pages/:slug/diff?from=&to=` | 逐行 diff |
| POST | `/pages/:slug/revert/:v` | 回滚（生成新版本） |
| GET | `/pages/:slug/related` | 相关条目 |
| GET | `/pages/:slug/comments` / POST | 评论与一层回复 |
| DELETE | `/comments/:id` | 管理员软删除 |
| GET | `/search?q=` | 标题/正文 LIKE 搜索 + 命中高亮 |
| GET | `/categories` | 树形分类 + 计数 |
| POST/PUT/DELETE | `/categories`、`/categories/:id` | 管理员分类 CRUD |
| GET | `/users/:username` | 公开用户主页与贡献 |
| GET | `/admin/stats` | 概览 + 7 日趋势 |
| GET | `/admin/review` / POST `/admin/review/:id` | 审核队列 |
| GET | `/admin/users` | 用户列表 |
| PATCH | `/admin/users/:id/role`、`/status` | 改角色 / 封禁 |
| POST | `/admin/users/:id/reset-password` | 重置密码 |
| GET | `/admin/audit-logs` | 审计日志（可按操作筛选） |
| GET/PUT | `/admin/settings` | 站点设置 |
| POST | `/upload` | 图片上传（2MB，MIME 白名单 + 魔数校验） |
| GET | `/site`、`/site/health` | 站点信息 / 健康检查 |

---

## 八、功能说明

- **Markdown 编辑器**：粗体/斜体/标题/链接/代码/表格/引用/列表/上传图片；Tab 缩进；Ctrl/Cmd+S 保存；localStorage 草稿（带恢复提示）；离开未保存提醒；左右分栏实时预览；Shiki 高亮；`[[条目名]]` 内链自动解析，不存在时显示红色「待创建」链接并跳转新建页。
- **版本管理**：编辑者/管理员每次保存生成 `PageRevision`（完整快照 + 摘要 + 编辑器）；审核通过时生成版本；回滚生成新版本，不覆盖历史；历史页支持任选两版逐行 diff（新增/删除行高亮 + 行号）与版本预览。
- **审核队列**：注册用户新建/修改写入待审字段，`Page.content` 保留已发布版本；通过后应用待审内容并生成版本，驳回时修改型回退到已发布状态、新建型退回草稿。
- **搜索**：Prisma 参数化的 `contains`（SQLite/PG 通用），标题命中权重最高，服务端生成带 `<mark>` 的安全片段（HTML 转义后再插入标记）。
- **评论**：Markdown 渲染、一层嵌套回复、管理员软删除并显示「该评论已被管理员删除」。
- **管理后台**：概览卡片 + 纯 SVG 折线趋势；审核；用户表格（角色/封禁/重置密码）；分类树 CRUD；站点设置；审计日志筛选与分页。
- **审计**：登录、注册、改角色、封禁/解封、删条目、回滚、审核通过/驳回、分类与设置变更、上传、改密全部落库（`AuditLog.detail` 为 JSON 字符串）。
- **移动端**：条目页左右栏收进抽屉，中栏单栏；375px 宽度下无横向滚动。

---

## 九、安全落地

- CSRF：`apps/api/src/middleware/csrf.ts`，全局应用于所有非安全方法。
- XSS：react-markdown 不启用 `rehype-raw`，原始 HTML 被丢弃；`rehype-sanitize` 白名单（`apps/web/src/lib/markdown.ts`）；`javascript:` 协议被默认 urlTransform 与 sanitize 双重拦截。
- SQL 注入：全部 Prisma 参数化查询，无字符串拼接 SQL。
- 权限：`apps/api/src/middleware/auth.ts` + 每个写路由的服务端角色检查。
- 限流：`express-rate-limit`，全局 100 次/分钟/IP，认证类 10 次/分钟/IP（`middleware/rateLimit.ts`）。
- 上传：随机文件名、扩展名白名单、MIME + 文件魔数校验、2MB 限制、`X-Content-Type-Options: nosniff`、不提供执行路径。
- 密码：bcrypt cost 12（满足「bcrypt cost=12」要求，纯 JS 实现避免原生编译依赖）。
- 响应头：CSP、X-Frame-Options、Referrer-Policy、Permissions-Policy；nginx 侧同样配置。
- Cookie：httpOnly、SameSite=Lax、生产可开 Secure；refresh 仅限 `/api/auth` 路径。
- 密钥：`.env` 在 `.gitignore` 中；生产环境启动时校验 JWT/CSRF 密钥长度 ≥32。

---

## 十、自检清单（对照硬性约束与验收）

- [x] Logo 原创：`apps/web/src/components/Logo.tsx` + `public/favicon.svg`，几何标记，无品牌元素。
- [x] 图标仅 Lucide：`apps/web/src/**` 所有图标来自 `lucide-react`。
- [x] 字体仅 OFL/Apache 开源字体，本地打包：`apps/web/src/main.tsx` 的 `@fontsource/*` 引入，无 CDN。
- [x] 全站无 `#FFFFFF`：色板见 `apps/web/src/styles/index.css`，组件只用变量/语义类。
- [x] 色板唯一：`tailwind.config.js` 全部映射到 CSS 变量。
- [x] 圆角 4–6px、淡阴影、字号阶梯、760px 正文宽度：`tailwind.config.js` + `.wiki-body`。
- [x] 三栏条目页（56px 顶栏 / 240px 分类树 / 760px 正文 / 200px 目录）：`pages/WikiPage.tsx`、`components/Header.tsx`。
- [x] Ctrl/Cmd+K 命令面板：`components/CommandPalette.tsx`、`Layout.tsx`。
- [x] 验证码 5 分钟过期、一次性、可刷新、IP 限流：`apps/api/src/routes/auth.routes.ts`、`lib/captcha.ts`。
- [x] 5 次失败锁定 15 分钟：`auth.routes.ts` 登录分支。
- [x] 游客只读、user 待审、editor 直发、admin 全权：`pages.routes.ts`、`admin.routes.ts`。
- [x] 版本对比增删行 + 回滚不覆盖历史：`lib/pages.ts`、`pages.routes.ts`、`History.tsx`、`DiffView.tsx`。
- [x] `<script>alert(1)</script>` 不执行：Markdown 管线不含 rehype-raw + rehype-sanitize。
- [x] 375px 不塌、不横向滚动：`WikiPage.tsx` 抽屉、响应式栅格。
- [x] 种子数据 8 条原创中文条目、3 个分类、代码块/表格/内链/图片占位：`apps/api/prisma/content.ts`。
- [x] Docker 一键启动：`docker-compose.yml` + 两个 Dockerfile + entrypoint。
- [x] 暗网说明书：`docs/onion.md`。

---

## 十一、常见问题

**构建时无法访问 npm registry**：为 Docker 配置代理或镜像源，或先在宿主机 `pnpm install` 后使用本地缓存构建。

**登录后立刻掉线**：通过 HTTPS 访问时把 `COOKIE_SECURE` 设为 `true`；纯 HTTP（含 `.onion`）保持 `false`。

**修改 schema 后数据库不更新**：容器启动时执行 `prisma db push`；破坏性变更需手动迁移。

**上传返回 400**：仅支持 PNG / JPEG / WebP / GIF，且文件内容必须与 MIME 一致。

**如何换站点名**：管理员后台「站点设置」，或直接修改 `Setting` 表；前端读取 `/api/site`。

---

## 十二、内容与许可

站内 8 条示例条目、示意图、文案均为本项目原创，未抄录任何百科站点文本。代码以 MIT 使用；示例文字以 CC BY-SA 4.0 共享。
