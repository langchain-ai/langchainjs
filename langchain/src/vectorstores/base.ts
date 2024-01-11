import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "vectorstores/base",
  newEntrypointName: "vectorstores",
  newPackageName: "@langchain/core",
});
export * from "@langchain/core/vectorstores";
