import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "schema/retriever",
  newEntrypointName: "retrievers",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/retrievers";
