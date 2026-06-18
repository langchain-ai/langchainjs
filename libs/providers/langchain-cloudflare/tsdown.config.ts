import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";
import pkg from "./package.json" with { type: "json" };

export default getBuildConfig({
  entry: ["./src/index.ts"],
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
  external: ["@cloudflare/workers-types"],
  plugins: [
    cjsCompatPlugin({
      files: ["dist/", "CHANGELOG.md", "README.md", "LICENSE"],
    }),
  ],
});
