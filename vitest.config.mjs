// vitest.config.mjs · Test runner settings (npm test). Only maps "@/..." to the project root, the same as
// jsconfig.json, so server modules that import "@/lib/..." can be tested.
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({ resolve: { alias: { '@': root } } });
