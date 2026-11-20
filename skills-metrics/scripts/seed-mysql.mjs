// =============================================================================
// scripts/seed-mysql.mjs · Seed MySQL database with schema.sql and starting data
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

if (fs.existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

async function main() {
  console.log('Seeding MySQL database for Skill Matrix...');
  const dbUrl = process.env.DATABASE_URL || 'mysql://skm:change-me@localhost:3306/skill_matrix';
  const sqlFile = path.resolve('schema.sql');

  if (!fs.existsSync(sqlFile)) {
    console.error('schema.sql not found. Run scripts/generate_schema_mysql.mjs first.');
    process.exit(1);
  }

  // Ensure target database exists
  try {
    const urlObj = new URL(dbUrl);
    const dbName = urlObj.pathname.replace(/^\//, '');
    if (dbName) {
      const baseUrl = `${urlObj.protocol}//${urlObj.username ? `${urlObj.username}:${urlObj.password}@` : ''}${urlObj.host}`;
      const rootConn = await mysql.createConnection(baseUrl);
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await rootConn.end();
    }
  } catch (err) {
    // If connecting without db fails, proceed to attempt direct connection
  }

  console.log('Connecting to MySQL at', dbUrl.replace(/:[^:@]+@/, ':****@'), '...');
  let connection;
  try {
    connection = await mysql.createConnection({
      uri: dbUrl,
      multipleStatements: true,
    });
  } catch (err) {
    console.error('Could not connect to MySQL:', err.message);
    console.log('Note: Ensure the MySQL container is running (docker compose up -d db)');
    process.exit(1);
  }

  try {
    console.log('Executing schema.sql...');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    await connection.query(sql);
    console.log('✓ MySQL database successfully seeded from schema.sql');
  } catch (err) {
    console.error('Error executing seed SQL:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
