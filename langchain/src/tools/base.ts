import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "tools/base",
  newEntrypointName: "tools",
  newPackageName: "@langchain/core",
});
export {
  type ToolParams,
  ToolInputParsingException,
  StructuredTool,
  Tool,
} from "@langchain/core/tools";
