import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "memory/base",
  newEntrypointName: "memory",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/memory";
export { getBufferString } from "@langchain/core/messages";
