/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // 관심종목이 비어 있을 때 프론트가 /api/stock&_t=... 로 호출해 404 나는 버그 우회
    return [
      {
        source: '/api/stock&:path*',
        destination: '/api/stock?:path*',
      },
    ];
  },
};
module.exports = nextConfig;