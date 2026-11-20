#!/bin/sh
set -e

echo "[layoff] Syncing Prisma schema to MySQL..."
npx prisma db push --skip-generate

echo "[layoff] Checking if initial seed is needed..."
USER_COUNT=$(node -e "const { PrismaClient } = require('./lib/prisma-client'); const p = new PrismaClient(); p.user.count().then(c => { console.log(c); return p.\$disconnect(); }).catch(() => { console.log('0'); process.exit(0); });")

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
  echo "[layoff] Empty database detected — running initial seed..."
  npx tsx prisma/seed.ts
else
  echo "[layoff] Database already initialized ($USER_COUNT users found) — skipping seed."
fi

echo "[layoff] Starting Next.js server on port ${PORT:-3005}..."
exec npx next start -H 0.0.0.0 -p "${PORT:-3005}"
