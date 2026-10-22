import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  basePath: '/auth',
  transpilePackages: [
    '@plant/contracts',
    '@plant/server',
    '@plant/ui',
    '@plant/auth-core',
    '@plant/bag-core',
  ],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};
export default config;
