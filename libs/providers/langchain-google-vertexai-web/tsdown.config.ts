import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: ["./src/index.ts", "./src/utils.ts", "./src/types.ts"],
  plugins: [cjsCompatPlugin()],
});
