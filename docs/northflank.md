# Northflank 部署说明（Sandbox 免费额度）

Northflank Sandbox 当前提供：2 个 service、2 个 job、1 个 database、2 个项目、最高 $20/月资源额度，常驻不休眠，注册不需要信用卡。它按 Dockerfile 构建，支持持久卷、私有端口、自定义域名和健康检查。**它不是 Docker Compose 平台**，所以这套 `web + api + db` 要拆成两个 service 加一个 Postgres addon。

## 一、资源映射

| 本仓库 | Northflank |
|---|---|
| `web` 容器（nginx） | Deployment service：Dockerfile `apps/web/Dockerfile`，公开端口 80 |
| `api` 容器（Express） | Deployment service：Dockerfile `apps/api/Dockerfile`，私有端口 4000 |
| `db` 容器 | PostgreSQL addon（1 个 database 名额） |
| `atlas-uploads` 卷 | API service 挂载持久卷到 `/app/uploads` |
| `docker-entrypoint.sh` | API 启动命令，保留即可（单实例） |

Sandbox 的 2 个 service 名额刚好用完，1 个 database 名额给 Postgres。不要再多开第三个 service。

## 二、创建顺序

1. 注册 Northflank，创建 project，选择离用户近的 region。
2. **Addon → PostgreSQL**：0.1 vCPU / 256MB / 10GB 起步，创建后复制连接串。
3. **Service → Deployment**，连接 Git 仓库，构建 API：
   - Build context：仓库根目录
   - Dockerfile：`apps/api/Dockerfile`
   - Port：`4000`，类型 **private**
   - Health check：HTTP `/api/site/health`
   - Volume：挂载 `/app/uploads`
4. 再建 web service：
   - Build context：仓库根目录
   - Dockerfile：`apps/web/Dockerfile`
   - Port：`80`，类型 **public**
5. 给 web 配域名，或用 Northflank 给的 `*.northflank.app` 地址；把该地址填进 API 的 `APP_ORIGIN`。

## 三、API 环境变量

```ini
NODE_ENV=production
PORT=4000
DATABASE_PROVIDER=postgresql
DATABASE_URL=<Postgres addon 的连接串>
APP_ORIGIN=https://<web 的公开地址>
COOKIE_SECURE=true
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
CSRF_SECRET=<openssl rand -hex 32>
UPLOAD_DIR=/app/uploads
SEED_ADMIN_PASSWORD=Admin@12345
SEED_EDITOR_PASSWORD=Editor@12345
SEED_USER_PASSWORD=User@12345
```

`DATABASE_URL` 也可以在 Variables 里直接引用 Postgres addon 的连接变量，控制台提供一键注入。

## 四、服务间通信

`apps/web/nginx.conf` 里写的是：

```nginx
proxy_pass http://api:4000;
```

把 API service 命名为 `api`，同一 project 内可通过服务名访问私有端口。若控制台展示了完整的内部域名，把 `api` 换成该域名后重新构建 web。

API 的 4000 保持 private，公网只暴露 web 的 80/443。这样 API 不直接对外，和 compose 里的网络隔离一致。

## 五、首次启动与验证

API 的 entrypoint 会执行：

```bash
node scripts/set-provider.mjs
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
node dist/server.js
```

Sandbox 单实例下可以这样做；多实例或正式生产建议把 `db push` / seed 拆成一次性的 job，再让服务只跑 `node dist/server.js`。

验证：

```bash
curl https://<web 地址>/api/site/health
curl https://<web 地址>/api/pages?pageSize=1
```

浏览器打开 web 地址，`admin / Admin@12345` 登录并强制改密。

## 六、额度与尺寸

按公开单价粗算（每月）：

| 组件 | 规格 | 约 |
|---|---|---|
| web | 0.1 vCPU / 256MB | $2.8 |
| api | 0.2 vCPU / 512MB | $5.5 |
| Postgres | 0.1 vCPU / 256MB + 10GB | $4 |
| uploads 卷 | 5GB | $0.6 |

合计约 $13，落在 Sandbox 的 $20/月额度内。实际账单以控制台用量为准；超出额度需要转 Pay as you go。

## 七、暗网-only 的注意点

Northflank 是明网 PaaS，会分配公开的 `*.northflank.app` 入口。要纯洋葱：

- 只把 web 建为 **worker**（不暴露公开端口），在自定义 web 镜像里同时跑 `tor` 与 nginx，`HiddenServicePort 80 127.0.0.1:80`，洋葱私钥放持久卷；
- API 继续用 private 端口，只让 web worker 访问；
- 这样平台入口不对外，访客只走 `.onion`。

代价是要维护一个带 `tor` + `supervisord` 的组合镜像，部署和重启都会换 Tor 进程；省事的纯洋葱方案仍然是 Oracle Always Free 或家里机器 + system Tor。Northflank 更适合明网部署。

## 八、常见问题

- **构建 OOM**：Vite 构建比运行时吃内存。提高构建实例规格，或本地 `docker buildx` 后推 GHCR / Docker Hub，Northflank 直接部署镜像。
- **web 启动时 DNS 解析失败**：先确认 API service 已创建且名称为 `api`，私有端口 4000 已开放；再重启 web。
- **登录掉线**：`COOKIE_SECURE=true` 必须配合 HTTPS 域名；`APP_ORIGIN` 要与实际访问地址一致。
- **上传 502**：确认持久卷挂载在 `/app/uploads`，API 进程对该目录有写权限。
- **额度耗尽**：Sandbox 资源上限 $20/月，扩容前先看 Usage。
