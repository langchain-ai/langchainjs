/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack config (Next.js 16+ default bundler)
  turbopack: {
    resolveAlias: {
      // Alias node: protocol imports to their non-prefixed equivalents
      "node:async_hooks": "async_hooks",
      "node:fs": "fs",
      "node:fs/promises": "fs",
      "node:path": "path",
      // Disable Node.js modules that aren't available in browser/edge
      async_hooks: { browser: false },
      typeorm: { browser: false },
    },
  },
};

module.exports = nextConfig;
