import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "embeddings/llama_cpp",
});
export * from "@langchain/community/embeddings/llama_cpp";
