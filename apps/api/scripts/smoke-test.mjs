import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./dev.db';
const prisma = new PrismaClient();
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000';

function makeJar() {
  const jar = new Map();
  return {
    jar,
    store(response) {
      const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      for (const cookie of cookies) {
        const [pair] = cookie.split(';');
        const index = pair.indexOf('=');
        if (index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
    },
    header() {
      return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
    },
  };
}

async function request(jar, path, { method = 'GET', body, csrf = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && csrf) headers['x-csrf-token'] = jar.jar.get('atlas_csrf') ?? '';
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar.store(response);
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

async function csrf(jar) {
  const result = await request(jar, '/auth/csrf');
  if (result.status !== 200) throw new Error(`csrf 失败: ${result.status}`);
  return jar.jar.get('atlas_csrf');
}

async function captcha(jar) {
  const result = await request(jar, '/auth/captcha');
  if (result.status !== 200) throw new Error(`验证码失败: ${result.status}`);
  const row = await prisma.captcha.findUnique({ where: { id: result.payload.data.captchaId } });
  return { captchaId: result.payload.data.captchaId, answer: row?.answer ?? '' };
}

async function login(jar, identifier, password) {
  await csrf(jar);
  const { captchaId, answer } = await captcha(jar);
  const result = await request(jar, '/auth/login', {
    method: 'POST',
    body: { identifier, password, captchaId, captchaAnswer: answer.toUpperCase() },
  });
  return result;
}

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  const anon = makeJar();
  await csrf(anon);

  const unauthorized = await request(anon, '/pages', {
    method: 'POST',
    body: { title: '无权限测试', content: '游客不应创建。' },
  });
  check('游客写接口返回 401', unauthorized.status === 401, `status=${unauthorized.status}`);

  const noCsrf = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'x', captchaId: '00000000-0000-4000-8000-000000000000', captchaAnswer: 'aaaa' }),
  });
  check('缺少 CSRF 头被拒绝', noCsrf.status === 403, `status=${noCsrf.status}`);

  const adminJar = makeJar();
  const adminLogin = await login(adminJar, 'admin', 'Admin@12345');
  check('管理员登录成功', adminLogin.status === 200, `status=${adminLogin.status}`);
  check('管理员首次登录要求改密', adminLogin.payload?.data?.user?.mustChangePassword === true);

  const me = await request(adminJar, '/auth/me');
  check('会话 Cookie 生效', me.payload?.data?.user?.username === 'admin');

  adminJar.jar.delete('atlas_access');
  const expiredMe = await request(adminJar, '/auth/me');
  check('access 缺失时返回 401 以便刷新', expiredMe.status === 401, `status=${expiredMe.status}`);
  const refreshed = await request(adminJar, '/auth/refresh', { method: 'POST' });
  check('refresh token 可轮换会话', refreshed.status === 200, `status=${refreshed.status}`);
  const meAfterRefresh = await request(adminJar, '/auth/me');
  check('刷新后会话恢复', meAfterRefresh.payload?.data?.user?.username === 'admin');

  const created = await request(adminJar, '/pages', {
    method: 'POST',
    body: {
      title: '冒烟测试条目',
      content: '# 冒烟测试条目\n\n用于验证创建、版本与删除。\n\n<script>alert(1)</script>\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
      summary: '自动化冒烟测试',
      tags: ['测试'],
      editSummary: '冒烟测试创建',
    },
  });
  check('管理员可直接发布条目', created.status === 201 && created.payload?.data?.pending === false, `status=${created.status}`);
  const slug = created.payload?.data?.page?.slug;

  const page = await request(adminJar, `/pages/${slug}`);
  check('条目详情可读', page.status === 200 && page.payload?.data?.page?.title === '冒烟测试条目');
  check('详情包含版本号', page.payload?.data?.page?.revisionCount >= 1);

  const updated = await request(adminJar, `/pages/${slug}`, {
    method: 'PUT',
    body: {
      title: '冒烟测试条目',
      content: '# 冒烟测试条目\n\n第二版内容。\n\n<script>alert(1)</script>',
      editSummary: '第二版',
      tags: ['测试'],
    },
  });
  check('编辑后生成新版本', updated.status === 200, `status=${updated.status}`);

  const revisions = await request(adminJar, `/pages/${slug}/revisions`);
  check('版本列表返回两版', revisions.payload?.data?.revisions?.length === 2);

  const diff = await request(adminJar, `/pages/${slug}/diff?from=1&to=2`);
  check('diff 含增删行', diff.status === 200 && diff.payload?.data?.lines?.some((line) => line.type === 'add'));

  const revert = await request(adminJar, `/pages/${slug}/revert/1`, { method: 'POST' });
  check('回滚生成 v3', revert.status === 200 && revert.payload?.data?.version === 3);

  const search = await request(anon, `/search?q=${encodeURIComponent('冒烟测试')}`);
  check('搜索命中新条目', search.payload?.data?.hits?.some((hit) => hit.slug === slug));
  check('搜索片段已转义脚本标签', !String(search.payload?.data?.hits?.[0]?.snippet ?? '').includes('<script>'));

  const userJar = makeJar();
  const userLogin = await login(userJar, 'wanderer', 'User@12345');
  check('普通用户登录成功', userLogin.status === 200, `status=${userLogin.status}`);

  const pending = await request(userJar, '/pages', {
    method: 'POST',
    body: {
      title: '待审测试条目',
      content: '# 待审测试条目\n\n由注册用户提交。',
      summary: '待审测试',
      tags: ['测试'],
    },
  });
  check('普通用户提交进入待审', pending.status === 201 && pending.payload?.data?.pending === true, `status=${pending.status}`);
  const pendingId = pending.payload?.data?.page?.id;
  const pendingSlug = pending.payload?.data?.page?.slug;

  const pendingList = await request(userJar, '/admin/review');
  check('普通用户无权访问审核队列', pendingList.status === 403, `status=${pendingList.status}`);

  const editorJar = makeJar();
  const editorLogin = await login(editorJar, 'editor', 'Editor@12345');
  check('编辑者登录成功', editorLogin.status === 200);

  const reviewList = await request(editorJar, '/admin/review');
  check('审核队列包含待审条目', reviewList.payload?.data?.items?.some((item) => item.id === pendingId));

  const approve = await request(editorJar, `/admin/review/${pendingId}`, {
    method: 'POST',
    body: { decision: 'approve', reason: '冒烟测试通过' },
  });
  check('编辑者审核通过', approve.status === 200, `status=${approve.status}`);

  const published = await request(anon, `/pages/${encodeURIComponent(pendingSlug)}`);
  check('审核后条目公开', published.status === 200 && published.payload?.data?.page?.status === 'published');

  const adminUsers = await request(editorJar, '/admin/users');
  check('编辑者无权管理用户', adminUsers.status === 403);

  const audit = await request(adminJar, '/admin/audit-logs?action=review_approve');
  check('审计日志记录审核', audit.payload?.data?.logs?.length >= 1);

  const deleted = await request(adminJar, `/pages/${slug}`, { method: 'DELETE' });
  check('管理员软删除条目', deleted.status === 200);
  const gone = await request(anon, `/pages/${slug}`);
  check('删除后对游客不可见', gone.status === 404);

  const failed = results.filter((item) => !item.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 项通过`);
  if (failed.length) {
    console.log('失败项：', failed.map((item) => item.name).join('、'));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
