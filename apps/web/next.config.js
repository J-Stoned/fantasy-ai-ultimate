/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Skip type checking during dev for faster startup
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig