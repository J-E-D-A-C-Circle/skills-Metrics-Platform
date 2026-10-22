import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema.js',
  out: './drizzle/migrations',
  dialect: 'mysql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'mysql://skm:change-me@localhost:3306/skill_matrix',
  },
});
