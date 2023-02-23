import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "./agents/index.ts",
    "./agents/tools/index.ts",
    "./chains/index.ts",
    "./embeddings/index.ts",
    "./llms/index.ts",
    "./prompts/index.ts",
    "./vectorstores/index.ts",
    "./text_splitter.ts",
    "./memory/index.ts",
    "./document.ts",
    "./docstore/index.ts",
    "./document_loaders/index.ts",
    "./index.ts",
  ],
  dts: true,
  format: ["cjs", "esm"],
  clean: true,
  splitting: false,
  target: "es2018",
});
