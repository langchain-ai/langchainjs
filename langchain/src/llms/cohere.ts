import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "llms/cohere",
  newEntrypointName: "",
  newPackageName: "@langchain/cohere",
});
export * from "@langchain/community/llms/cohere";
