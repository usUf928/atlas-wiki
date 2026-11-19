# Atlas Wiki 暗网（Tor Onion Service）部署说明书

本说明书把已经跑起来的 Atlas Wiki 发布为一个 Tor v3 隐藏服务。适合离线社区、内部知识库、跨地域小范围协作等场景。全流程只依赖 Tor 与 Docker，不需要公网 IP、域名或证书。

> 阅读前提：宿主机已能 `docker compose up` 正常打开站点。先按 README 完成一次本地部署，再执行本文。

---

## 一、架构

```
Tor 网络
   │  （v3 onion，端到端加密）
   ▼
本机 Tor 守护进程  ──►  127.0.0.1:8080  ──►  nginx（web 容器）
                                                   │ /api /uploads
                                                   ▼
                                             api 容器 :4000
                                                   │
                                                   ▼
                                             postgres 容器
```

- Tor 只把本地 8080 暴露为 `.onion:80`，宿主机不需要开放任何入站端口。
- nginx、API、数据库都只监听容器网络；8080 仅绑定 `127.0.0.1`。
- `.onion` 流量在 Tor 网络内部已加密，不需要再配 HTTPS 证书。

---

## 二、服务器准备

以 Debian 12 / Ubuntu 22.04 为例：

```bash
sudo apt update
sudo apt install -y tor curl

# 确认 Docker 与 Compose 可用
docker --version
docker compose version
```

防火墙只需放行 SSH（按需）与 Tor 的出站连接，**不要**放行 8080：

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw enable
```

---

## 三、让站点只监听本机回环

编辑 `docker-compose.yml` 的 web 端口映射：

```yaml
  web:
    ports:
      - "127.0.0.1:8080:80"
```

然后重建：

```bash
docker compose up -d --build
curl -fsS http://127.0.0.1:8080/api/site/health
```

返回 `{"code":0,...}` 即站点正常。此时从外网访问 `服务器IP:8080` 应当连接失败，这是预期结果。

---

## 四、配置 Tor 隐藏服务

### 1. 创建目录

```bash
sudo mkdir -p /var/lib/tor/atlas-wiki
sudo chown -R debian-tor:debian-tor /var/lib/tor/atlas-wiki
sudo chmod 700 /var/lib/tor/atlas-wiki
```

### 2. 写入 torrc

编辑 `/etc/tor/torrc`，追加：

```text
HiddenServiceDir /var/lib/tor/atlas-wiki/
HiddenServicePort 80 127.0.0.1:8080
HiddenServiceVersion 3
```

如果只想让隐藏服务运行而不做出口中继，确认 `SocksPort` 保持默认即可；不需要配置 `ExitRelay`。

### 3. 重启并读取地址

```bash
sudo systemctl restart tor
sleep 10
sudo cat /var/lib/tor/atlas-wiki/hostname
```

输出形如：

```
atlaswikinamexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.onion
```

这就是站点地址（v3 固定 56 个字符 + `.onion`）。首次发布通常需要 30–90 秒才能在网络中可解析。

### 4. 本机验证

```bash
sudo apt install -y torsocks
torsocks curl -fsS http://<你的地址>.onion/api/site/health
```

若返回健康检查 JSON，说明 Tor 到 nginx 的链路已经打通。

---

## 五、针对暗网的站点配置

编辑 `.env`（与 `docker-compose.yml` 同目录），至少修改以下项：

```ini
APP_ORIGIN=http://<你的地址>.onion
COOKIE_SECURE=false
POSTGRES_PASSWORD=<32 位以上随机串>
JWT_ACCESS_SECRET=<32 位以上随机串>
JWT_REFRESH_SECRET=<32 位以上随机串>
CSRF_SECRET=<32 位以上随机串>
```

生成随机串：

```bash
openssl rand -hex 32
```

然后：

```bash
docker compose up -d
```

### 关闭公开注册

首次以 `admin` 登录（默认 `Admin@12345`，会强制改密），进入「管理后台 → 站点设置」，关闭「开放注册」。这样只有管理员能开通账号，避免陌生注册与滥用。

### 清理演示账号

```bash
docker compose exec api npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.user.update({ where: { username: 'editor' }, data: { status: 'banned' } }).catch(() => {});
await prisma.user.update({ where: { username: 'wanderer' }, data: { status: 'banned' } }).catch(() => {});
await prisma.\$disconnect();
"
```

也可以直接在「用户管理」里封禁或改密码。正式使用前请修改三个种子账号的密码。

### 为什么 `COOKIE_SECURE=false`

`.onion` 站点通过 HTTP 访问（加密由 Tor 提供），如果开启 Secure，浏览器不会回传 Cookie，登录会失效。若在 Tor 之外还挂了 HTTPS 反向代理，再改为 `true`。

### CSP 与外部资源

Atlas Wiki 的字体、图标、脚本全部本地打包，CSP 为 `default-src 'self'`，页面不会向明网发起请求，避免通过第三方资源泄露访问者与站点信息。不要在条目里引用外部图片或统计脚本。

---

## 六、首次对外发布检查表

- [ ] `hostname` 文件权限为 `600`、目录权限 `700`，属主 `debian-tor`
- [ ] `docker compose ps` 三个容器均 healthy
- [ ] 外网无法直连 8080（`nmap` 或手机流量访问 `http://IP:8080` 失败）
- [ ] `torsocks curl` 能取到 `/api/site/health`
- [ ] Tor Browser 打开 `.onion`，注册关闭、登录正常、能创建条目
- [ ] 管理员密码、数据库密码、三个 JWT/CSRF 密钥均已更换
- [ ] 站点设置里的站名、描述、页脚已改为自己的内容
- [ ] 上传目录与数据库已纳入备份
- [ ] 服务器时钟同步（`timedatectl`），否则 JWT 校验与验证码过期会异常

---

## 七、备份与恢复

### 备份

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U atlas atlas > backups/atlas-$(date +%F).sql
docker run --rm -v atlas-wiki_atlas-uploads:/data -v "$PWD/backups":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
sudo tar czf backups/tor-keys-$(date +%F).tar.gz -C /var/lib/tor atlas-wiki
```

三样东西缺一不可：数据库、上传文件、**隐藏服务私钥**。私钥丢失意味着 `.onion` 地址永久改变。

### 恢复

```bash
docker compose up -d db
cat backups/atlas-YYYY-MM-DD.sql | docker compose exec -T db psql -U atlas -d atlas
docker run --rm -v atlas-wiki_atlas-uploads:/data -v "$PWD/backups":/backup alpine \
  sh -c "tar xzf /backup/uploads-YYYY-MM-DD.tar.gz -C /data"
sudo tar xzf backups/tor-keys-YYYY-MM-DD.tar.gz -C /var/lib/tor
sudo systemctl restart tor
```

---

## 八、运维与隐私

1. **审计日志里的 IP**：经 Tor 访问时，API 看到的客户端地址是 `127.0.0.1`，审计日志不会记录访问者真实 IP，这是 Tor 的正常行为。
2. **nginx 访问日志**：如需进一步减少本地痕迹，可在 `apps/web/nginx.conf` 的 `server` 块加入 `access_log off;`，只保留错误日志。
3. **上传图片**：建议上传前去除 EXIF（GPS、设备型号）。服务端只校验类型与大小，不剥离元数据。
4. **不要启用外部邮箱**：`POST /api/auth/email-code` 在开发环境把验证码写入控制台并回传 `devHint`；公网/暗网环境不要把它接到第三方邮件服务，以免泄露。
5. **升级**：`git pull`（或替换源码）后执行 `docker compose up -d --build`。数据库 schema 由 entrypoint 的 `prisma db push` 同步，破坏性字段变更前先备份。
6. **监控**：`docker compose ps`、`docker compose logs -f api`、`curl 127.0.0.1:8080/api/site/health`。不需要把监控端口暴露到 Tor。
7. **不要在同一台机器上同时运行明网入口**：若必须如此，明网入口请使用独立域名与独立 Cookie 域，避免把两边的访问者关联起来。
8. **Tor 桥接与审查**：在 Tor 被封锁的网络中，为客户端配置 obfs4/Snowflake 网桥；服务端本身不需要桥接。

---

## 九、故障排查

| 现象 | 排查 |
|---|---|
| `hostname` 文件不存在 | `sudo journalctl -u tor -n 50` 查看 torrc 语法或目录权限 |
| `.onion` 打不开，但 `torsocks curl` 正常 | 等待 1–2 分钟；确认使用 Tor Browser；确认地址完整 56 位 |
| 502 Bad Gateway | `docker compose ps` 看 api 是否 healthy；`docker compose logs api` |
| 登录后立即退出 | `COOKIE_SECURE` 应为 `false`；确认 `APP_ORIGIN` 与访问地址一致 |
| 上传 413 | nginx `client_max_body_size` 已设 3m，确认图片 ≤2MB |
| 验证码一直错误 | 服务器时间偏差；`timedatectl` 校时后重试 |
| 端口被外网访问到 | 端口映射必须写成 `127.0.0.1:8080:80`，而不是 `8080:80` |
| 修改 compose 不生效 | `docker compose up -d --force-recreate` |

---

## 十、最小化发布命令序列

```bash
# 1. 站点
cd /opt/atlas-wiki
cp .env.example .env
# 编辑 .env：强随机密钥、APP_ORIGIN、COOKIE_SECURE=false
# 编辑 docker-compose.yml：ports: "127.0.0.1:8080:80"
docker compose up -d --build

# 2. Tor
sudo mkdir -p /var/lib/tor/atlas-wiki
sudo chown -R debian-tor:debian-tor /var/lib/tor/atlas-wiki
sudo chmod 700 /var/lib/tor/atlas-wiki
echo -e "HiddenServiceDir /var/lib/tor/atlas-wiki/\nHiddenServicePort 80 127.0.0.1:8080\nHiddenServiceVersion 3" | sudo tee -a /etc/tor/torrc
sudo systemctl restart tor

# 3. 地址
sleep 10
sudo cat /var/lib/tor/atlas-wiki/hostname

# 4. 验证
torsocks curl -fsS "http://$(sudo cat /var/lib/tor/atlas-wiki/hostname)/api/site/health"

# 5. 登录后台，关闭注册、改密码、改站点信息
```

完成以上步骤后，任何安装 Tor Browser 的人都可以通过 `.onion` 地址访问这座低照度档案馆，而站点服务器的真实网络位置不会暴露给访问者。
