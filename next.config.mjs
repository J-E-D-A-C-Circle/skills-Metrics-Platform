import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  outputFileTracingRoot: __dirname,
  // Every app URL (/profile, /forms, /users …) renders the single-page app at "/".
  async rewrites() {
    return [{ source: '/:path((?!_next|assets|api|favicon).+)', destination: '/' }];
  },
};
export default nextConfig;
