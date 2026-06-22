import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@squash/contracts',
    '@squash/db',
    '@squash/domain',
    '@squash/i18n',
    '@squash/server',
  ],
};

export default config;
