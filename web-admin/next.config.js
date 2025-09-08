/** @type {import('next').NextConfig} */
const path = require('path')
const nextConfig = {
  reactStrictMode: true,
  // Reduce file watcher pressure on systems with low fd limits/inotify quotas
  webpackDevMiddleware: (config) => {
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
    return config
  },
}

module.exports = nextConfig
