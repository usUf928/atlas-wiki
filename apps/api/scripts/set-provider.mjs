import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(process.cwd(), 'prisma/schema.prisma');
const provider = (process.env.DATABASE_PROVIDER ?? 'sqlite').toLowerCase();

if (provider !== 'sqlite' && provider !== 'postgresql') {
  console.error(`不支持的 DATABASE_PROVIDER: ${provider}`);
  process.exit(1);
}

const source = readFileSync(schemaPath, 'utf8');
const next = source.replace(/(datasource db \{[^}]*provider\s*=\s*)"[^"]+"/, `$1"${provider}"`);

if (next !== source) {
  writeFileSync(schemaPath, next, 'utf8');
  console.log(`[prisma] datasource provider 已切换为 ${provider}`);
} else {
  console.log(`[prisma] datasource provider 保持为 ${provider}`);
}
