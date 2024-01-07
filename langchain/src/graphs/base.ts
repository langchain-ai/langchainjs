import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "graphs/base",
  newEntrypointName: "graphs",
  newPackageName: "@langchain/core",
});
export * from "@langchain/core/graphs";