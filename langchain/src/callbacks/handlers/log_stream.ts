import { logVersion010MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "callbacks/handlers/log_stream",
  newEntrypointName: "tracers/log_stream",
  newPackageName: "@langchain/core",
});
export * from "@langchain/core/tracers/log_stream";
