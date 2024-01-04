import { logVersion010MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "runnables",
  newEntrypointName: "runnables",
  newPackageName: "@langchain/core",
});

export {
  type Branch,
  type BranchLike,
  RunnableBranch,
} from "@langchain/core/runnables";
