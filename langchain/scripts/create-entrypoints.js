import * as fs from "fs";
import * as path from "path";

const entrypoints = {
  agents: "agents/index",
  "agents/load": "agents/load",
  base_language: "base_language/index",
  tools: "agents/tools/index",
  chains: "chains/index",
  "chains/load": "chains/load",
  embeddings: "embeddings/index",
  "embeddings/base": "embeddings/base",
  "embeddings/fake": "embeddings/fake",
  "embeddings/openai": "embeddings/openai",
  "embeddings/cohere": "embeddings/cohere",
  llms: "llms/index",
  prompts: "prompts/index",
  "prompts/load": "prompts/load",
  vectorstores: "vectorstores/index",
  text_splitter: "text_splitter",
  memory: "memory/index",
  document: "document",
  docstore: "docstore/index",
  document_loaders: "document_loaders/index",
  chat_models: "chat_models/index",
  schema: "schema/index",
  sql_db: "sql_db",
  callbacks: "callbacks/index",
  output_parsers: "output_parsers/index",
  retrievers: "retrievers/index",
  cache: "cache",
};

// Entrypoints in this list will
// 1. Be excluded from the documentation
// 2. Be only available in Node.js environments (for backwards compatibility)
const deprecatedNodeOnly = ["embeddings"];

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
  updateJsonFile("./tsconfig.json", (json) => ({
    ...json,
    typedocOptions: {
      ...json.typedocOptions,
      entryPoints: [...Object.keys(entrypoints)]
        .filter((key) => !deprecatedNodeOnly.includes(key))
        .map((key) => `src/${entrypoints[key]}.ts`),
    },
  }));

  const generatedFiles = generateFiles();
  const filenames = Object.keys(generatedFiles);

  updateJsonFile("./package.json", (json) => ({
    ...json,
    exports: Object.assign(
      Object.fromEntries(
        ["index", ...Object.keys(entrypoints)].map((key) => {
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

          // If there is a *.lite.js file add it as the root `import` export,
          // which should/will then be used by non-Node environments.
          const litePath = `./dist/${entrypoints[key]}.lite.js`;
          if (fs.existsSync(litePath)) {
            const { types, ...rest } = entryPoint;
            entryPoint = {
              types,
              node: rest,
              import: litePath,
              require: `./dist/${entrypoints[key]}.lite.cjs`,
              default: litePath,
            };
          }

          return [key === "index" ? "." : `./${key}`, entryPoint];
        })
      ),
      { "./package.json": "./package.json" }
    ),
    files: ["dist/", ...filenames],
  }));

  Object.entries(generatedFiles).forEach(([filename, content]) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  });
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

const command = process.argv[2];

if (command === "clean") {
  cleanGenerated();
} else {
  updateConfig();
}
