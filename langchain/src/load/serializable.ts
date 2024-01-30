import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "load/serializable",
  newEntrypointName: "load/serializable",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/load/serializable";
