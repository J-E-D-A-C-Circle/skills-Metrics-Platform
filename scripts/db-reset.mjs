// =============================================================================
// scripts/db-reset.mjs · Reset MySQL database and re-seed
// =============================================================================
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { execSync } from 'node:child_process';

if (fs.existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

async function main() {
  const dbUrl = process.env.DATABASE_URL || 'mysql://skm:change-me@localhost:3306/skill_matrix';
  const urlObj = new URL(dbUrl);
  const dbName = urlObj.pathname.replace(/^\//, '') || 'skill_matrix';

  // Connect without database selected to recreate it
  const baseUrl = `${urlObj.protocol}//${urlObj.username}:${urlObj.password}@${urlObj.host}`;

  console.log(`Resetting database "${dbName}"...`);
  try {
    const conn = await mysql.createConnection(baseUrl);
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await conn.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
    console.log(`Database "${dbName}" dropped and recreated.`);
  } catch (err) {
    console.error('Failed to reset database:', err.message);
    process.exit(1);
  }

  console.log('Seeding fresh database...');
  execSync('node --experimental-detect-module scripts/seed-mysql.mjs', { stdio: 'inherit' });
}

main();
