/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['yahoo-finance2'],
  experimental: {
    esmExternals: 'loose',
  },
}
module.exports = nextConfig