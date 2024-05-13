import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "vectorstores/qdrant",
  newEntrypointName: "",
  newPackageName: "@langchain/qdrant",
});
export * from "@langchain/community/vectorstores/qdrant";
