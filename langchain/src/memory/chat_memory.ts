import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "memory/chat_memory",
});

export * from "@langchain/community/memory/chat_memory";
