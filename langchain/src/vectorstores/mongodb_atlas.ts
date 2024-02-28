import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "vectorstores/mongodb_atlas",
  newEntrypointName: "",
  newPackageName: "@langchain/mongodb",
});
export * from "@langchain/community/vectorstores/mongodb_atlas";
