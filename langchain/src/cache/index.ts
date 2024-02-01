import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "cache",
  newEntrypointName: "caches",
  newPackageName: "@langchain/core",
});
export { InMemoryCache } from "@langchain/core/caches";
