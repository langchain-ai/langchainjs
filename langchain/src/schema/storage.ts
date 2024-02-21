import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "schema/storage",
  newEntrypointName: "stores",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/stores";
