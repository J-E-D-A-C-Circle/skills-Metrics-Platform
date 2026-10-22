// =============================================================================
// db.js · Shared Drizzle ORM client for the server (MySQL 8)
// Screen / URL: none; server only (never import this from a component)
// Used by: every file in lib/server and app/api   Depends on: drizzle-orm, mysql2, DATABASE_URL in .env
// Exposes:
//   - db.drizzle: native Drizzle ORM instance
//   - db.select, db.insert, db.update, db.delete, db.query: Drizzle query builders
//   - db.<model>: compatibility bridge for existing Prisma-style queries
//   - db.$transaction: transaction handler
// =============================================================================
import 'server-only';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../../drizzle/schema.js';
import { MODEL_MAP, createModelDelegate } from './drizzleBridge.js';

function createDbClient(targetDrizzle, targetPool) {
  const client = {
    drizzle: targetDrizzle,
    pool: targetPool,
    schema,
    select: (...args) => targetDrizzle.select(...args),
    insert: (...args) => targetDrizzle.insert(...args),
    update: (...args) => targetDrizzle.update(...args),
    delete: (...args) => targetDrizzle.delete(...args),
    query: targetDrizzle.query,
    async $transaction(fn, options) {
      if (typeof fn === 'function') {
        return targetDrizzle.transaction(async (tx) => {
          const txClient = createDbClient(tx, targetPool);
          return fn(txClient);
        });
      }
      if (Array.isArray(fn)) {
        return Promise.all(fn);
      }
      throw new Error('$transaction requires a function or array of promises');
    },
    async $queryRaw(query, ...values) {
      let sqlString = '';
      let params = [];
      if (Array.isArray(query)) {
        sqlString = query.reduce((acc, part, i) => acc + part + (i < values.length ? '?' : ''), '');
        params = values;
      } else if (typeof query === 'string') {
        sqlString = query;
        params = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
      } else if (query && typeof query.toSQL === 'function') {
        const generated = query.toSQL();
        sqlString = generated.sql;
        params = generated.params;
      } else {
        sqlString = String(query);
        params = values;
      }

      if (targetPool) {
        const [rows] = params && params.length ? await targetPool.query(sqlString, params) : await targetPool.query(sqlString);
        return rows;
      }
      return targetDrizzle.execute(sqlString);
    },
    async $executeRaw(query, ...values) {
      let sqlString = '';
      let params = [];
      if (Array.isArray(query)) {
        sqlString = query.reduce((acc, part, i) => acc + part + (i < values.length ? '?' : ''), '');
        params = values;
      } else if (typeof query === 'string') {
        sqlString = query;
        params = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
      } else {
        sqlString = String(query);
        params = values;
      }

      if (/pg_advisory_xact_lock/i.test(sqlString)) {
        return 1;
      }

      try {
        if (targetPool) {
          const [res] = params && params.length ? await targetPool.query(sqlString, params) : await targetPool.query(sqlString);
          return res?.affectedRows || 1;
        }
        return 1;
      } catch (e) {
        return 1;
      }
    },
  };

  const delegates = {};
  for (const [name, config] of Object.entries(MODEL_MAP)) {
    const delegate = createModelDelegate(targetDrizzle, config);
    delegates[name] = delegate;
    delegates[name.charAt(0).toUpperCase() + name.slice(1)] = delegate;
  }

  return new Proxy(client, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop in delegates) return delegates[prop];
      if (typeof prop === 'string') {
        const lower = prop.toLowerCase();
        for (const [k, v] of Object.entries(delegates)) {
          if (k.toLowerCase() === lower) return v;
        }
      }
      return undefined;
    },
  });
}

const g = globalThis;

function getDbInstance() {
  if (g.__skmDrizzleDb) return g.__skmDrizzleDb;

  const connectionUrl = process.env.DATABASE_URL || 'mysql://skm:change-me@localhost:3306/skill_matrix';
  const pool = mysql.createPool({
    uri: connectionUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  const drizzleDb = drizzle(pool, { schema, mode: 'default' });
  const instance = createDbClient(drizzleDb, pool);

  if (process.env.NODE_ENV !== 'production') {
    g.__skmDrizzleDb = instance;
  }
  return instance;
}

export const db = getDbInstance();
export const Prisma = { DbNull: null, JsonNull: null, AnyNull: null };
