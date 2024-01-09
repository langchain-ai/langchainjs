import { logVersion010MigrationWarning } from "./util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "document",
  newEntrypointName: "documents",
  newPackageName: "@langchain/core",
});

export { type DocumentInput, Document } from "@langchain/core/documents";
