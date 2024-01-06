import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "storage/vercel_kv",
});
export * from "@langchain/community/storage/vercel_kv";
