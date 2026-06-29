/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [
      {
        source: '/api/stock&:path*',
        destination: '/api/stock?:path*',
      },
    ];
  },
};
module.exports = nextConfig;