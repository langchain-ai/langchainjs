import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "cache/upstash_redis",
  newEntrypointName: "caches/upstash_redis",
});
export * from "@langchain/community/caches/upstash_redis";
