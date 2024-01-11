import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "vectorstores/cloudflare_vectorize",
  newEntrypointName: "",
  newPackageName: "@langchain/cloudflare",
});
export * from "@langchain/community/vectorstores/cloudflare_vectorize";
