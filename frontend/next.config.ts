import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile Privy and related packages
  transpilePackages: ['@privy-io/react-auth'],

  // Mark Node.js-only packages as external for server-side
  serverExternalPackages: [
    'pino',
    'pino-pretty',
    'thread-stream',
  ],

  // Turbopack configuration to handle problematic modules
  turbopack: {
    resolveAlias: {
      // Stub out pino and thread-stream for client-side builds
      'pino': { browser: './src/lib/stubs/pino.ts' },
      'thread-stream': { browser: './src/lib/stubs/empty.ts' },
    },
  },

  webpack: (config, { isServer }) => {
    // Handle Node.js modules that shouldn't be bundled for client
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        worker_threads: false,
      };
    }

    // Externalize pino and thread-stream to avoid bundling issues
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'thread-stream': 'commonjs thread-stream',
        'pino': 'commonjs pino',
      });
    }

    return config;
  },
};

export default nextConfig;
