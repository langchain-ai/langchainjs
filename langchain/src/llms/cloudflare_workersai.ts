import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "llms/cloudflare_workersai",
  newEntrypointName: "",
  newPackageName: "@langchain/cloudflare",
});
export * from "@langchain/community/llms/cloudflare_workersai";
