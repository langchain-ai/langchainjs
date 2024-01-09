import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "cache/momento",
  newEntrypointName: "caches/momento",
});
export * from "@langchain/community/caches/momento";
