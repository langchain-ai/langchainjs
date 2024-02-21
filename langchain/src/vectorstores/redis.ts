import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "vectorstores/redis",
  newEntrypointName: "",
  newPackageName: "@langchain/redis",
});
export * from "@langchain/community/vectorstores/redis";
