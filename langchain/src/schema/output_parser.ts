import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "schema/output_parser",
  newEntrypointName: "output_parsers",
  newPackageName: "@langchain/core",
});

export * from "@langchain/core/output_parsers";
