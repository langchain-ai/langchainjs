import * as fs from "fs";
import * as path from "path";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  // agents
  agents: "agents/index",
  "agents/load": "agents/load",
  // base language
  base_language: "base_language/index",
  // tools
  tools: "tools/index",
  "tools/aws_lambda": "tools/aws_lambda",
  "tools/calculator": "tools/calculator",
  "tools/webbrowser": "tools/webbrowser",
  // chains
  chains: "chains/index",
  "chains/load": "chains/load",
  // embeddings
  embeddings: "embeddings/index",
  "embeddings/base": "embeddings/base",
  "embeddings/fake": "embeddings/fake",
  "embeddings/openai": "embeddings/openai",
  "embeddings/cohere": "embeddings/cohere",
  "embeddings/tensorflow": "embeddings/tensorflow",
  "embeddings/hf": "embeddings/hf",
  // llms
  llms: "llms/index",
  "llms/load": "llms/load",
  "llms/base": "llms/base",
  "llms/openai": "llms/openai",
  "llms/cohere": "llms/cohere",
  "llms/hf": "llms/hf",
  "llms/replicate": "llms/replicate",
  // prompts
  prompts: "prompts/index",
  "prompts/load": "prompts/load",
  // vectorstores
  vectorstores: "vectorstores/index",
  "vectorstores/base": "vectorstores/base",
  "vectorstores/memory": "vectorstores/memory",
  "vectorstores/chroma": "vectorstores/chroma",
  "vectorstores/hnswlib": "vectorstores/hnswlib",
  "vectorstores/weaviate": "vectorstores/weaviate",
  "vectorstores/mongo": "vectorstores/mongo",
  "vectorstores/pinecone": "vectorstores/pinecone",
  "vectorstores/supabase": "vectorstores/supabase",
  "vectorstores/opensearch": "vectorstores/opensearch",
  "vectorstores/milvus": "vectorstores/milvus",
  "vectorstores/prisma": "vectorstores/prisma",
  "vectorstores/myscale": "vectorstores/myscale",
  // text_splitter
  text_splitter: "text_splitter",
  // memory
  memory: "memory/index",
  // document
  document: "document",
  // docstore
  docstore: "docstore/index",
  // document_loaders
  document_loaders: "document_loaders/index",
  "document_loaders/base": "document_loaders/base",
  "document_loaders/web/cheerio": "document_loaders/web/cheerio",
  "document_loaders/web/puppeteer": "document_loaders/web/puppeteer",
  "document_loaders/web/playwright": "document_loaders/web/playwright",
  "document_loaders/web/college_confidential":
    "document_loaders/web/college_confidential",
  "document_loaders/web/gitbook": "document_loaders/web/gitbook",
  "document_loaders/web/hn": "document_loaders/web/hn",
  "document_loaders/web/imsdb": "document_loaders/web/imsdb",
  "document_loaders/web/github": "document_loaders/web/github",
  "document_loaders/web/s3": "document_loaders/web/s3",
  "document_loaders/web/confluence": "document_loaders/web/confluence",
  "document_loaders/fs/directory": "document_loaders/fs/directory",
  "document_loaders/fs/buffer": "document_loaders/fs/buffer",
  "document_loaders/fs/text": "document_loaders/fs/text",
  "document_loaders/fs/json": "document_loaders/fs/json",
  "document_loaders/fs/srt": "document_loaders/fs/srt",
  "document_loaders/fs/pdf": "document_loaders/fs/pdf",
  "document_loaders/fs/docx": "document_loaders/fs/docx",
  "document_loaders/fs/epub": "document_loaders/fs/epub",
  "document_loaders/fs/csv": "document_loaders/fs/csv",
  "document_loaders/fs/notion": "document_loaders/fs/notion",
  "document_loaders/fs/unstructured": "document_loaders/fs/unstructured",
  // chat_models
  chat_models: "chat_models/index",
  "chat_models/base": "chat_models/base",
  "chat_models/openai": "chat_models/openai",
  "chat_models/anthropic": "chat_models/anthropic",
  // schema
  schema: "schema/index",
  "schema/output_parser": "schema/output_parser",
  // sql_db
  sql_db: "sql_db",
  // callbacks
  callbacks: "callbacks/index",
  // output_parsers
  output_parsers: "output_parsers/index",
  // retrievers
  retrievers: "retrievers/index",
  "retrievers/remote": "retrievers/remote/index",
  "retrievers/supabase": "retrievers/supabase",
  "retrievers/metal": "retrievers/metal",
  "retrievers/databerry": "retrievers/databerry",
  "retrievers/contextual_compression": "retrievers/contextual_compression",
  "retrievers/document_compressors": "retrievers/document_compressors/index",
  "retrievers/time_weighted": "retrievers/time_weighted",
  "retrievers/document_compressors/chain_extract":
    "retrievers/document_compressors/chain_extract",
  "retrievers/hyde": "retrievers/hyde",
  // cache
  cache: "cache/index",
  "cache/redis": "cache/redis",
  // stores
  "stores/file/in_memory": "stores/file/in_memory",
  "stores/file/node": "stores/file/node",
  "stores/message/dynamodb": "stores/message/dynamodb",
  "stores/message/redis": "stores/message/redis",
  // experimental
  "experimental/autogpt": "experimental/autogpt/index",
  "experimental/babyagi": "experimental/babyagi/index",
  "experimental/plan_and_execute": "experimental/plan_and_execute/index",
  client: "client/index",
};

// Entrypoints in this list will
// 1. Be excluded from the documentation
// 2. Be only available in Node.js environments (for backwards compatibility)
const deprecatedNodeOnly = [
  "embeddings",
  "llms",
  "chat_models",
  "vectorstores",
  "retrievers",
  "document_loaders",
];

// Entrypoints in this list require an optional dependency to be installed.
// Therefore they are not tested in the generated test-exports-* packages.
const requiresOptionalDependency = [
  "agents/load",
  "tools/aws_lambda",
  "tools/calculator",
  "tools/webbrowser",
  "chains/load",
  "embeddings/cohere",
  "embeddings/tensorflow",
  "embeddings/hf",
  "llms/load",
  "llms/cohere",
  "llms/hf",
  "llms/replicate",
  "prompts/load",
  "vectorstores/chroma",
  "vectorstores/hnswlib",
  "vectorstores/weaviate",
  "vectorstores/mongo",
  "vectorstores/pinecone",
  "vectorstores/supabase",
  "vectorstores/opensearch",
  "vectorstores/milvus",
  "vectorstores/myscale",
  "document_loaders/web/cheerio",
  "document_loaders/web/puppeteer",
  "document_loaders/web/playwright",
  "document_loaders/web/college_confidential",
  "document_loaders/web/gitbook",
  "document_loaders/web/hn",
  "document_loaders/web/imsdb",
  "document_loaders/web/github",
  "document_loaders/web/s3",
  "document_loaders/web/confluence",
  "document_loaders/fs/directory",
  "document_loaders/fs/buffer",
  "document_loaders/fs/text",
  "document_loaders/fs/json",
  "document_loaders/fs/srt",
  "document_loaders/fs/pdf",
  "document_loaders/fs/docx",
  "document_loaders/fs/epub",
  "document_loaders/fs/csv",
  "document_loaders/fs/notion",
  "document_loaders/fs/unstructured",
  "sql_db",
  "retrievers/supabase",
  "retrievers/metal",
  "cache/redis",
  "stores/file/node",
  "stores/message/dynamodb",
  "stores/message/redis",
];

// List of test-exports-* packages which we use to test that the exports field
// works correctly across different JS environments.
// Each entry is a tuple of [package name, import statement].
const testExports = [
  [
    "test-exports-esm",
    (p) => `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`,
  ],
  [
    "test-exports-cjs",
    (p) => `const ${p.replace(/\//g, "_")} = require("langchain/${p}");`,
  ],
  ["test-exports-cf", (p) => `export * from "langchain/${p}";`],
  ["test-exports-cra", (p) => `export * from "langchain/${p}";`],
  ["test-exports-vercel", (p) => `export * from "langchain/${p}";`],
  ["test-exports-vite", (p) => `export * from "langchain/${p}";`],
];

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
  // Update tsconfig.json `typedocOptions.entryPoints` field
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

  // Update package.json `exports` and `files` fields
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

          return [key === "index" ? "." : `./${key}`, entryPoint];
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

  // Update test-exports-*/entrypoints.js
  const entrypointsToTest = Object.keys(entrypoints)
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => !requiresOptionalDependency.includes(key));
  testExports.forEach(([pkg, importStatement]) => {
    const contents =
      entrypointsToTest.map((key) => importStatement(key)).join("\n") + "\n";
    fs.writeFileSync(`../${pkg}/src/entrypoints.js`, contents);
  });
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
