import * as fs from "fs";
import * as path from "path";
import { identifySecrets } from "./identify-secrets.js";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  "agents": "agents",
  "caches": "caches",
  "callbacks/base": "callbacks/base",
  "callbacks/manager": "callbacks/manager",
  "callbacks/promises": "callbacks/promises",
  "chat_history": "chat_history",
  "documents": "documents/index",
  "embeddings": "embeddings",
  "example_selectors": "example_selectors/index",
  "language_models/base": "language_models/base",
  "language_models/chat_models": "language_models/chat_models",
  "language_models/llms": "language_models/llms",
  load: "load/index",
  "load/serializable": "load/serializable",
  "memory": "memory",
  "messages": "messages/index",
  "output_parsers": "output_parsers/index",
  "outputs": "outputs",
  "prompts": "prompts/index",
  "prompt_values": "prompt_values",
  "runnables": "runnables/index",
  "retrievers": "retrievers",
  "stores": "stores",
  "tools": "tools",
  "tracers/base": "tracers/base",
  "tracers/console": "tracers/console",
  "tracers/initialize": "tracers/initialize",
  "tracers/log_stream": "tracers/log_stream",
  "tracers/run_collector": "tracers/run_collector",
  "tracers/tracer_langchain_v1": "tracers/tracer_langchain_v1",
  "tracers/tracer_langchain": "tracers/tracer_langchain",
  "utils/async_caller": "utils/async_caller",
  "utils/env": "utils/env",
  "utils/hash": "utils/hash",
  "utils/json_patch": "utils/json_patch",
  "utils/json_schema": "utils/json_schema",
  "utils/math": "utils/math",
  "utils/stream": "utils/stream",
  "utils/testing": "utils/testing/index",
  "utils/tiktoken": "utils/tiktoken",
  "utils/types": "utils/types",
  "vectorstores": "vectorstores",
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
    `  "@langchain/core/${k}"?:
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
