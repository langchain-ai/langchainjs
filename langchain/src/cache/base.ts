import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "cache/base",
  newEntrypointName: "caches",
  newPackageName: "@langchain/core",
});
export * from "@langchain/core/caches";
