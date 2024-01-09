import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "cache/cloudflare_kv",
  newEntrypointName: "caches/cloudflare_kv",
});
export * from "@langchain/community/caches/cloudflare_kv";
