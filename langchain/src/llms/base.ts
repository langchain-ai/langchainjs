import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "llms/base",
  newEntrypointName: "language_models/llms",
  newPackageName: "@langchain/core",
});
export * from "@langchain/core/language_models/llms";
