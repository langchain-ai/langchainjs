// ---------------------------------------------
// CLI for creating integration docs.
// ---------------------------------------------
import { Command } from "commander";
import { fillChatIntegrationDocTemplate } from "./chat.js";

type CLIInput = {
  package: string;
  module: string;
  type: string;
};

async function main() {
  const program = new Command();
  program
    .description("Create a new integration doc.")
    .option(
      "--package <package>",
      "Package name, eg openai. Should be value of @langchain/<package>"
    )
    .option("--module <module>", "Module name, e.g ChatOpenAI")
    .option("--type <type>", "Type of integration, e.g. 'chat'");

  program.parse();

  const options = program.opts<CLIInput>();

  const { module: moduleName, type } = options;
  let { package: packageName } = options;

  if (packageName.startsWith("@langchain/")) {
    packageName = packageName.replace("@langchain/", "");
  }

  switch (type) {
    case "chat":
      await fillChatIntegrationDocTemplate({ packageName, moduleName });
      break;
    default:
      console.error(
        `Invalid type: ${type}.\nOnly 'chat' is supported at this time.`
      );
      process.exit(1);
  }
}

main().catch((err) => {
  throw err;
});
