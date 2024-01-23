import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "chat_models/base",
  newEntrypointName: "language_models/chat_models",
  newPackageName: "@langchain/core",
});
export * from "@langchain/core/language_models/chat_models";
