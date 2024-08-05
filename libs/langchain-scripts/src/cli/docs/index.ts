// ---------------------------------------------
// CLI for creating integration docs.
// ---------------------------------------------
import { Command } from "commander";
import { fillChatIntegrationDocTemplate } from "./chat.js";
import { fillDocLoaderIntegrationDocTemplate } from "./document_loaders.js";
import { fillLLMIntegrationDocTemplate } from "./llms.js";
import { fillRetrieverIntegrationDocTemplate } from "./retrievers.js";
import { fillEmbeddingsIntegrationDocTemplate } from "./embeddings.js";
import { fillToolkitIntegrationDocTemplate } from "./toolkits.js";

type CLIInput = {
  type: string;
  classname: string;
};

const ALLOWED_TYPES = [
  "chat",
  "llm",
  "retriever",
  "embeddings",
  "doc_loader",
  "toolkit",
];

async function main() {
  const program = new Command();
  program
    .description("Create a new integration doc.")
    .option(
      "--classname <classname>",
      "Class name of the integration. e.g ChatOpenAI"
    )
    .option(
      "--type <type>",
      `Type of integration.\nMust be one of:\n - ${ALLOWED_TYPES.join("\n - ")}`
    );

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
    case "toolkit":
      await fillToolkitIntegrationDocTemplate({
        className,
      });
      break;
    default:
      console.error(
        `Invalid type: '${type}'.\nMust be one of:\n - ${ALLOWED_TYPES.join(
          "\n - "
        )}`
      );
      process.exit(1);
  }
}

main().catch((err) => {
  throw err;
});
