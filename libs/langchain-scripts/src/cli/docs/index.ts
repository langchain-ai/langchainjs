// ---------------------------------------------
// CLI for creating integration docs.
// ---------------------------------------------
import { Command } from "commander";
import { fillChatIntegrationDocTemplate } from "./chat.js";
import { fillDocLoaderIntegrationDocTemplate } from "./document_loaders.js";
import { fillLLMIntegrationDocTemplate } from "./llms.js";
import { fillRetrieverIntegrationDocTemplate } from "./retrievers.js";
import { fillEmbeddingsIntegrationDocTemplate } from "./embeddings.js";

type CLIInput = {
  package: string;
  module: string;
  type: string;
  community: boolean;
};

async function main() {
  const program = new Command();
  program
    .description("Create a new integration doc.")
    .option("--package <package>", "Package name, eg openai.")
    .option("--module <module>", "Module name, e.g ChatOpenAI")
    .option("--type <type>", "Type of integration, e.g. 'chat'")
    .option(
      "--community",
      "If the integration is a community integration. Will effect the fields populated in the template."
    );

  program.parse();

  const options = program.opts<CLIInput>();

  const { module: moduleName, type, community: isCommunity } = options;
  let { package: packageName } = options;

  if (packageName.startsWith("@langchain/")) {
    packageName = packageName.replace("@langchain/", "");
  }

  switch (type) {
    case "chat":
      await fillChatIntegrationDocTemplate({
        packageName,
        moduleName,
        isCommunity,
      });
      break;
    case "doc_loader":
      await fillDocLoaderIntegrationDocTemplate({
        packageName,
        moduleName,
      });
      break;
    case "llm":
      await fillLLMIntegrationDocTemplate({
        packageName,
        moduleName,
        isCommunity,
      });
      break;
    case "retriever":
      await fillRetrieverIntegrationDocTemplate({
        packageName,
        moduleName,
        isCommunity,
      });
      break;
    case "embeddings":
      await fillEmbeddingsIntegrationDocTemplate({
        packageName,
        moduleName,
        isCommunity,
      });
      break;
    default:
      console.error(
        `Invalid type: ${type}.\nOnly 'chat', 'llm', 'retriever', 'embeddings' and 'doc_loader' are supported at this time.`
      );
      process.exit(1);
  }
}

main().catch((err) => {
  throw err;
});
