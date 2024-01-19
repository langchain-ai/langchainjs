import { createEntrypoints } from "@langchain/scripts";
import * as path from "path";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  chat_models: "chat_models",
  embeddings: "embeddings",
  index: "index",
  llms: "llms",
};

// Entrypoints in this list require an optional dependency to be installed.
// Therefore they are not tested in the generated test-exports-* packages.
const requiresOptionalDependency = [];

const absTsConfigPath = path.resolve(process.cwd(), "tsconfig.json");

createEntrypoints({
  entrypoints,
  requiresOptionalDependency,
  absTsConfigPath,
});
