import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "cache/ioredis",
  newEntrypointName: "caches/ioredis",
});
export * from "@langchain/community/caches/ioredis";
