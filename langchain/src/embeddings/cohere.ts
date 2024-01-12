import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "embeddings/cohere",
  newEntrypointName: "",
  newPackageName: "@langchain/cohere",
});
export * from "@langchain/community/embeddings/cohere";
