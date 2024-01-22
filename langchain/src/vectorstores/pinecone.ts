import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "vectorstores/pinecone",
  newEntrypointName: "",
  newPackageName: "@langchain/pinecone",
});
export * from "@langchain/community/vectorstores/pinecone";
