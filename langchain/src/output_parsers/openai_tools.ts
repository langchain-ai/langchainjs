import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "output_parsers",
  newEntrypointName: "output_parsers/openai_tools",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/output_parsers/openai_tools";
