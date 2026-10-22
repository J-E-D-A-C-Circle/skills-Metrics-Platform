// =============================================================================
// scripts/db-migrate.mjs · Run database migrations or push schema to MySQL
// =============================================================================
import fs from 'node:fs';
import { execSync } from 'node:child_process';

if (fs.existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

console.log('Running Drizzle database migration / push...');
try {
  execSync('npx drizzle-kit push', { stdio: 'inherit' });
  console.log('Database schema synchronized successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
}
