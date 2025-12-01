import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: [
    "./src/index.ts",
    "./src/utils/index.ts",
    "./src/types.ts",
    "./src/experimental/media.ts",
    "./src/experimental/utils/media_core.ts",
  ],
  plugins: [
    cjsCompatPlugin({
      files: ["dist/", "CHANGELOG.md", "README.md", "LICENSE"],
    }),
  ],
});
