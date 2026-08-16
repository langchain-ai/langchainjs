/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack is the default bundler in Next.js 16+.
  // Stub out Node.js built-ins that are unavailable in the browser.
  // The { browser: ... } conditional only applies the alias for client builds,
  // leaving server/SSR/API builds with the real Node.js modules.
  turbopack: {
    resolveAlias: {
      "node:async_hooks": { browser: "./src/empty.cjs" },
      "node:fs": { browser: "./src/empty.cjs" },
      "node:fs/promises": { browser: "./src/empty.cjs" },
      "node:path": { browser: "./src/empty.cjs" },
      async_hooks: { browser: "./src/empty.cjs" },
      fs: { browser: "./src/empty.cjs" },
      "fs/promises": { browser: "./src/empty.cjs" },
      path: { browser: "./src/empty.cjs" },
      typeorm: { browser: "./src/empty.cjs" },
    },
  },
};

module.exports = nextConfig;
