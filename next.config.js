/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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