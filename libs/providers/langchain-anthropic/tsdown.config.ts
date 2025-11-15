import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: ["./src/index.ts"],
  plugins: [cjsCompatPlugin()],
});
