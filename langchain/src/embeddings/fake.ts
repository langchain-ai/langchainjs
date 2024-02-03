import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

export * from "@langchain/core/utils/testing";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "embeddings/fake",
  newEntrypointName: "utils/testing",
  newPackageName: "@langchain/core",
});
