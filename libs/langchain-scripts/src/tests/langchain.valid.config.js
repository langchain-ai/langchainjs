export const config = {
  entrypoints: {
    agents: "src/agents/index.ts",
    utils: "src/utils/index.ts",
  },
  tsConfigPath: "tsconfig.json",
  cjsSource: "build/cjs",
  cjsDestination: "dist/cjs",
  abs: (relativePath) => `/absolute/path/${relativePath}`,
  requiresOptionalDependency: ["some-optional-package"],
  deprecatedNodeOnly: ["old-node-only-feature"],
  deprecatedOmitFromImportMap: ["redundant-feature"],
  packageSuffix: "community",
  shouldTestExports: true,
  extraImportMapEntries: [
    {
      modules: ["extra-module"],
      alias: ["extra-alias"],
      path: "extra/path",
    },
  ],
  gitignorePaths: ["node_modules", "dist", ".yarn"],
  internals: [/^internal-regex/],
};
