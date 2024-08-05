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
  type: string;
  community: boolean;
  classname: string;
};

async function main() {
  const program = new Command();
  program
    .description("Create a new integration doc.")
    .option(
      "--classname <classname>",
      "Class name of the integration. e.g ChatOpenAI"
    )
    .option("--type <type>", "Type of integration, e.g. 'chat'");

  program.parse();

  const options = program.opts<CLIInput>();

  const { classname: className, type } = options;

  switch (type) {
    case "chat":
      await fillChatIntegrationDocTemplate({
        className,
      });
      break;
    case "llm":
      await fillLLMIntegrationDocTemplate({
        className,
      });
      break;
    case "embeddings":
      await fillEmbeddingsIntegrationDocTemplate({
        className,
      });
      break;
    case "retriever":
      await fillRetrieverIntegrationDocTemplate({
        className,
      });
      break;
    case "doc_loader":
      await fillDocLoaderIntegrationDocTemplate({
        className,
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
