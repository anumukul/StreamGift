const path = require('path')

/**
 * Next.js config — alias `thread-stream` to a local stub to avoid Turbopack
 * trying to parse package test files and non-js assets from that module.
 */
module.exports = {
  // Empty turbopack config silences Turbopack/webpack conflict warning in Next 16
  turbopack: {},
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    const stub = path.resolve(__dirname, 'empty-module.js')
    // stub known problematic transitive/test-only modules
    const aliases = [
      'thread-stream',
      'pino',
      'tap',
      'tape',
      'desm',
      'why-is-node-running',
      'fastbench',
      'pino-elasticsearch',
      'why-is-node-running',
      'desm',
    ]
    for (const name of aliases) config.resolve.alias[name] = stub
    return config
  },
}
