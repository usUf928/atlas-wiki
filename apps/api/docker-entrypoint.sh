#!/bin/sh
set -e

cd /app/apps/api

node scripts/set-provider.mjs

echo "[entrypoint] 等待数据库并同步 schema…"
attempt=0
until npx prisma db push --skip-generate >/tmp/prisma-db-push.log 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "[entrypoint] 数据库不可用，最后输出："
    cat /tmp/prisma-db-push.log
    exit 1
  fi
  sleep 2
done
echo "[entrypoint] schema 已同步"

echo "[entrypoint] 写入种子数据（幂等）…"
npx tsx prisma/seed.ts || echo "[entrypoint] 种子数据已存在或写入失败，继续启动"

exec node dist/server.js
