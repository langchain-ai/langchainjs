import * as fs from "fs";
import * as path from "path";
import { identifySecrets } from "./identify-secrets.js";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  "callbacks/base": "callbacks/base",
  "callbacks/manager": "callbacks/manager",
  "callbacks/promises": "callbacks/promises",
  "callbacks/tracers/base": "callbacks/tracers/base",
  "callbacks/tracers/console": "callbacks/tracers/console",
  "callbacks/tracers/initialize": "callbacks/tracers/initialize",
  "callbacks/tracers/log_stream": "callbacks/tracers/log_stream",
  "callbacks/tracers/run_collector": "callbacks/tracers/run_collector",
  "callbacks/tracers/tracer_langchain_v1": "callbacks/tracers/tracer_langchain_v1",
  "callbacks/tracers/tracer_langchain": "callbacks/tracers/tracer_langchain",
  "chat_model": "chat_model",
  "llm": "llm",
  load: "load/index",
  "load/serializable": "load/serializable",
  "prompts": "prompts/index",
  "prompts/base": "prompts/base",
  "prompts/chat": "prompts/chat",
  "prompts/few_shot": "prompts/few_shot",
  "prompts/pipeline": "prompts/pipeline",
  "prompts/serde": "prompts/serde",
  "prompts/template": "prompts/template",
  "prompts/example_selector/base": "prompts/example_selector/base",
  "prompts/example_selector/conditional": "prompts/example_selector/conditional",
  "prompts/example_selector/length_based": "prompts/example_selector/length_based",
  "prompts/example_selector/semantic_similarity": "prompts/example_selector/semantic_similarity",
  "runnables": "runnables/index",
  "schema": "schema/index",
  "schema/agent": "schema/agent",
  "schema/cache": "schema/cache",
  "schema/chat_history": "schema/chat_history",
  "schema/document": "schema/document/index",
  "schema/embeddings": "schema/embeddings",
  "schema/language_model": "schema/language_model",
  "schema/memory": "schema/memory",
  "schema/messages": "schema/messages",
  "schema/output_parser": "schema/output_parser",
  "schema/output": "schema/output",
  "schema/prompt_template": "schema/prompt_template",
  "schema/prompt": "schema/prompt",
  "schema/retriever": "schema/retriever",
  "schema/storage": "schema/storage",
  "schema/vectorstore": "schema/vectorstore",
  "util/async_caller": "util/async_caller",
  "util/env": "util/env",
  "util/hash": "util/hash",
  "util/json_patch": "util/json_patch",
  "util/json_schema": "util/json_schema",
  "util/stream": "util/stream",
  "util/tiktoken": "util/tiktoken",
  "util/types": "util/types",
};

// Entrypoints in this list will
// 1. Be excluded from the documentation
// 2. Be only available in Node.js environments (for backwards compatibility)
const deprecatedNodeOnly = [];

// Entrypoints in this list require an optional dependency to be installed.
// Therefore they are not tested in the generated test-exports-* packages.
const requiresOptionalDependency = [];

const updateJsonFile = (relativePath, updateFunction) => {
  const contents = fs.readFileSync(relativePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(relativePath, JSON.stringify(res, null, 2) + "\n");
};

const generateFiles = () => {
  const files = [...Object.entries(entrypoints), ["index", "index"]].flatMap(
    ([key, value]) => {
      const nrOfDots = key.split("/").length - 1;
      const relativePath = "../".repeat(nrOfDots) || "./";
      const compiledPath = `${relativePath}dist/${value}.js`;
      return [
        [
          `${key}.cjs`,
          `module.exports = require('${relativePath}dist/${value}.cjs');`,
        ],
        [`${key}.js`, `export * from '${compiledPath}'`],
        [`${key}.d.ts`, `export * from '${compiledPath}'`],
      ];
    }
  );

  return Object.fromEntries(files);
};

const updateConfig = () => {
  const generatedFiles = generateFiles();
  const filenames = Object.keys(generatedFiles);

  // Update package.json `exports` and `files` fields
  updateJsonFile("./package.json", (json) => ({
    ...json,
    exports: Object.assign(
      Object.fromEntries(
        [...Object.keys(entrypoints)].map((key) => {
          let entryPoint = {
            types: `./${key}.d.ts`,
            import: `./${key}.js`,
            require: `./${key}.cjs`,
          };

          if (deprecatedNodeOnly.includes(key)) {
            entryPoint = {
              node: entryPoint,
            };
          }

          return [`./${key}`, entryPoint];
        })
      ),
      { "./package.json": "./package.json" }
    ),
    files: ["dist/", ...filenames],
  }));

  // Write generated files
  Object.entries(generatedFiles).forEach(([filename, content]) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  });

  // Update .gitignore
  fs.writeFileSync("./.gitignore", filenames.join("\n") + "\n");
};

const cleanGenerated = () => {
  const filenames = Object.keys(generateFiles());
  filenames.forEach((fname) => {
    try {
      fs.unlinkSync(fname);
    } catch {
      // ignore error
    }
  });
};

// Tuple describing the auto-generated import map (used by langchain/load)
// [package name, import statement, import map path]
// This will not include entrypoints deprecated or requiring optional deps.
const importMap = [
  "langchain-core",
  (k, p) => `export * as ${k.replace(/\//g, "__")} from "../${p}.js";`,
  "src/load/import_map.ts",
];

const generateImportMap = () => {
  // Generate import map
  const entrypointsToInclude = Object.keys(entrypoints)
    .filter((key) => key !== "load")
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => !requiresOptionalDependency.includes(key));
  const [pkg, importStatement, importMapPath] = importMap;
  const contents =
    entrypointsToInclude
      .map((key) => importStatement(key, entrypoints[key]))
      .join("\n") + "\n";
  fs.writeFileSync(
    `../${pkg}/${importMapPath}`,
    "// Auto-generated by `scripts/create-entrypoints.js`. Do not edit manually.\n\n" +
      contents
  );
};

const importTypes = [
  "langchain-core",
  (k, p) =>
    `  "langchain-core/${k}"?:
    | typeof import("../${p}.js")
    | Promise<typeof import("../${p}.js")>;`,
  "src/load/import_type.d.ts",
];

const generateImportTypes = () => {
  // Generate import types
  const [pkg, importStatement, importTypesPath] = importTypes;
  fs.writeFileSync(
    `../${pkg}/${importTypesPath}`,
    `// Auto-generated by \`scripts/create-entrypoints.js\`. Do not edit manually.

export interface OptionalImportMap {
${Object.keys(entrypoints)
  .filter((key) => !deprecatedNodeOnly.includes(key))
  .filter((key) => requiresOptionalDependency.includes(key))
  .map((key) => importStatement(key, entrypoints[key]))
  .join("\n")}
}

export interface SecretMap {
${[...identifySecrets()]
  .sort()
  .map((secret) => `  ${secret}?: string;`)
  .join("\n")}
}
`
  );
};

const importConstants = [
  "langchain-core",
  (k) => `  "langchain/${k}"`,
  "src/load/import_constants.ts",
];

const generateImportConstants = () => {
  // Generate import constants
  const entrypointsToInclude = Object.keys(entrypoints)
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => requiresOptionalDependency.includes(key));
  const [pkg, importStatement, importConstantsPath] = importConstants;
  const contents =
    entrypointsToInclude.length 
      ? "[\n" + entrypointsToInclude
        .map((key) => importStatement(key, entrypoints[key]))
        .join(",\n") + ",\n];\n" 
      : "[];\n";
  fs.writeFileSync(
    `../${pkg}/${importConstantsPath}`,
    "// Auto-generated by `scripts/create-entrypoints.js`. Do not edit manually.\n\nexport const optionalImportEntrypoints: string[] = " +
      contents
  );
};

const command = process.argv[2];

if (command === "pre") {
  cleanGenerated();
  generateImportMap();
  generateImportTypes();
  generateImportConstants();
} else {
  updateConfig();
}
