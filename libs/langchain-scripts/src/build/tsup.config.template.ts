import { defineConfig } from "tsup";

export default defineConfig({
  // Entry points - adjust for your package structure
  entry: ["src/index.ts", "src/*/*.ts"],
  // Output both ESM and CJS formats
  format: ["esm", "cjs"],
  // Generate declaration files
  dts: true,
  // enable treeshaking
  treeshake: "safest",
  // Generate sourcemaps
  sourcemap: true,
  // Clean output directory before build
  clean: true,
  // Specify output directory
  outDir: "dist",
  // Set output extension based on format
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".js" : ".cjs",
    };
  },
  // Ensure all external dependencies are properly excluded from the bundle
  // These will be taken from package.json dependencies/peerDependencies
  external: [],
});
