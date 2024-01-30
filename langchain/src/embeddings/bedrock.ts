import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "embeddings/bedrock",
});
export * from "@langchain/community/embeddings/bedrock";
