import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";
import pkg from "./package.json" with { type: "json" };

export default getBuildConfig({
  entry: [
    "./src/index.ts",
    "./src/utils/index.ts",
    "./src/types.ts",
    "./src/experimental/media.ts",
    "./src/experimental/utils/media_core.ts",
  ],
  define: { __PKG_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    cjsCompatPlugin({
      files: ["dist/", "CHANGELOG.md", "README.md", "LICENSE"],
    }),
  ],
});
