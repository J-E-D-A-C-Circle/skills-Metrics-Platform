import { defineConfig } from 'drizzle-kit';
import fs from 'node:fs';

if (fs.existsSync('.env')) {
  process.loadEnvFile?.('.env');
}

export default defineConfig({
  schema: './drizzle/schema.js',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://skm:change-me@localhost:3306/skill_matrix',
  },
});
