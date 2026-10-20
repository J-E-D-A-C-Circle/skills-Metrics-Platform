// =============================================================================
// db.js · One shared Prisma client for the server (PostgreSQL)
// Screen / URL: none; server only (never import this from a component)
// Used by: every file in lib/server and app/api   Depends on: @prisma/client, DATABASE_URL in .env
// Sections (search for these markers): DB CLIENT
// =============================================================================
import 'server-only';
import { PrismaClient } from '@prisma/client';

// ===== DB CLIENT · Shared instance =====
// In development Next reloads modules often; keeping the client on globalThis stops it opening a new
// connection pool on every reload.
const g = globalThis;
export const db = g.__skmPrisma || new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
if (process.env.NODE_ENV !== 'production') g.__skmPrisma = db;
