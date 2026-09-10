import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: ["./src/index.ts"],
  plugins: [
    cjsCompatPlugin({
      files: ["dist/", "CHANGELOG.md", "README.md", "LICENSE"],
    }),
  ],
});
