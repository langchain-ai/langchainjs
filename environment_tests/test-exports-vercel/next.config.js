/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, nextRuntime, webpack }) => {
    // Handle node: protocol imports
    const nodeImports = [
      "node:async_hooks",
      "node:fs",
      "node:fs/promises",
      "node:path",
    ];
    nodeImports.forEach((nodeImport) => {
      let moduleName = nodeImport.replace("node:", "");
      // Special case for fs/promises - use fs instead since fs/promises isn't a valid webpack module
      if (moduleName === "fs/promises") {
        moduleName = "fs";
      }
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          new RegExp(`^${nodeImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
          moduleName
        )
      );
    });

    // For client-side builds, provide fallbacks to disable Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Disable all Node.js modules that aren't available in browser/edge
        async_hooks: false,
        fs: false,
        path: false,
        typeorm: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
