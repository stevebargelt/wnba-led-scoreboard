/** @type {import('next').NextConfig} */
const path = require('path')
const nextConfig = {
  reactStrictMode: true,
  // Modern webpack configuration for file watching
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          // Ignore files outside the web-admin directory (e.g., repo root)
          path.resolve(__dirname, '../**/*'),
        ],
      }
    }
    return config
  },
}

module.exports = nextConfig
