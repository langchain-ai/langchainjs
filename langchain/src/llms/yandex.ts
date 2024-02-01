import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "llms/yandex",
  newEntrypointName: "",
  newPackageName: "@langchain/yandex",
});
export * from "@langchain/community/llms/yandex";
