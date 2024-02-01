import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "callbacks",
  newEntrypointName: "callbacks/base",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/callbacks/base";
