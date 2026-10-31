import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // NEXT_DIST_DIR lets two copies of the app run side by side without sharing build files (default .next).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  outputFileTracingRoot: __dirname,
  // pdfkit reads its font files from node_modules at run time, so it is loaded by Node instead of being bundled.
  serverExternalPackages: ['pdfkit'],
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.alias['@'] = __dirname;
    return config;
  },
  async headers() {
    return [
      {
        source: '/outlook/taskpane',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://webmail.dvla.gov.gh https://*.office.com https://*.office365.com https://*.outlook.com http://localhost:* https://localhost:*;",
          },
        ],
      },
      {
        source: '/api/outlook/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-requested-with' },
        ],
      },
    ];
  },
};
export default nextConfig;
