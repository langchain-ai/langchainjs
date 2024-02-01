import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "schema/document",
  newEntrypointName: "documents",
  newPackageName: "@langchain/core",
});

export {
  BaseDocumentTransformer,
  MappingDocumentTransformer,
} from "@langchain/core/documents";
