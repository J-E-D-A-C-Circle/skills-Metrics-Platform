// Route GET /api/health · quick check that the server can reach the database (no personal data)
import { db } from '@/lib/server/db';
import { json, handle } from '@/lib/server/http';

export const GET = handle(async () => {
  await db.$queryRaw`SELECT 1`;
  return json({ ok: true, database: 'up' });
});
