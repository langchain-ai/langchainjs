import { logVersion010MigrationWarning } from "../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion010MigrationWarning({
  oldEntrypointName: "embeddings/openai",
  newEntrypointName: "",
  newPackageName: "@langchain/openai",
});
export {
  type OpenAIEmbeddingsParams,
  OpenAIEmbeddings,
} from "@langchain/openai";
