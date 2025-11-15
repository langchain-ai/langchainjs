import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: ["./src/index.ts", "./src/vitest.ts"],
  plugins: [cjsCompatPlugin()],
});
