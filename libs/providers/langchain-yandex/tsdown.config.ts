import { getBuildConfig, cjsCompatPlugin } from "@langchain/build";

export default getBuildConfig({
  entry: [
    "./src/index.ts",
    "./src/chat_models.ts",
    "./src/embeddings.ts",
    "./src/llms.ts",
  ],
  plugins: [cjsCompatPlugin()],
});
