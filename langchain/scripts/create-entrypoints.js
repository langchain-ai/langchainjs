import * as fs from "fs";
import * as path from "path";
import { identifySecrets } from "./identify-secrets.js";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  load: "load/index",
  "load/serializable": "load/serializable",
  // agents
  agents: "agents/index",
  "agents/load": "agents/load",
  "agents/toolkits/aws_sfn": "agents/toolkits/aws_sfn",
  "agents/toolkits/sql": "agents/toolkits/sql/index",
  // base language
  base_language: "base_language/index",
  // tools
  tools: "tools/index",
  "tools/aws_lambda": "tools/aws_lambda",
  "tools/aws_sfn": "tools/aws_sfn",
  "tools/calculator": "tools/calculator",
  "tools/sql": "tools/sql",
  "tools/webbrowser": "tools/webbrowser",
  // chains
  chains: "chains/index",
  "chains/load": "chains/load",
  "chains/openai_functions": "chains/openai_functions/index",
  "chains/query_constructor": "chains/query_constructor/index",
  "chains/query_constructor/ir": "chains/query_constructor/ir",
  "chains/sql_db": "chains/sql_db/index",
  // embeddings
  embeddings: "embeddings/index",
  "embeddings/base": "embeddings/base",
  "embeddings/fake": "embeddings/fake",
  "embeddings/openai": "embeddings/openai",
  "embeddings/cohere": "embeddings/cohere",
  "embeddings/tensorflow": "embeddings/tensorflow",
  "embeddings/hf": "embeddings/hf",
  "embeddings/googlevertexai": "embeddings/googlevertexai",
  "embeddings/googlepalm": "embeddings/googlepalm",
  // llms
  llms: "llms/index",
  "llms/load": "llms/load",
  "llms/base": "llms/base",
  "llms/openai": "llms/openai",
  "llms/ai21": "llms/ai21",
  "llms/aleph_alpha": "llms/aleph_alpha",
  "llms/cohere": "llms/cohere",
  "llms/hf": "llms/hf",
  "llms/replicate": "llms/replicate",
  "llms/googlevertexai": "llms/googlevertexai",
  "llms/googlepalm": "llms/googlepalm",
  "llms/sagemaker_endpoint": "llms/sagemaker_endpoint",
  // prompts
  prompts: "prompts/index",
  "prompts/load": "prompts/load",
  // vectorstores
  vectorstores: "vectorstores/index",
  "vectorstores/base": "vectorstores/base",
  "vectorstores/elasticsearch": "vectorstores/elasticsearch",
  "vectorstores/memory": "vectorstores/memory",
  "vectorstores/chroma": "vectorstores/chroma",
  "vectorstores/hnswlib": "vectorstores/hnswlib",
  "vectorstores/faiss": "vectorstores/faiss",
  "vectorstores/weaviate": "vectorstores/weaviate",
  "vectorstores/lancedb": "vectorstores/lancedb",
  "vectorstores/mongo": "vectorstores/mongo",
  "vectorstores/mongodb_atlas": "vectorstores/mongodb_atlas",
  "vectorstores/pinecone": "vectorstores/pinecone",
  "vectorstores/qdrant": "vectorstores/qdrant",
  "vectorstores/supabase": "vectorstores/supabase",
  "vectorstores/opensearch": "vectorstores/opensearch",
  "vectorstores/milvus": "vectorstores/milvus",
  "vectorstores/prisma": "vectorstores/prisma",
  "vectorstores/typeorm": "vectorstores/typeorm",
  "vectorstores/myscale": "vectorstores/myscale",
  "vectorstores/redis": "vectorstores/redis",
  "vectorstores/typesense": "vectorstores/typesense",
  "vectorstores/singlestore": "vectorstores/singlestore",
  "vectorstores/tigris": "vectorstores/tigris",
  "vectorstores/vectara": "vectorstores/vectara",
  // text_splitter
  text_splitter: "text_splitter",
  // memory
  memory: "memory/index",
  "memory/zep": "memory/zep",
  // document
  document: "document",
  // document_loaders
  document_loaders: "document_loaders/index",
  "document_loaders/base": "document_loaders/base",
  "document_loaders/web/apify_dataset": "document_loaders/web/apify_dataset",
  "document_loaders/web/cheerio": "document_loaders/web/cheerio",
  "document_loaders/web/puppeteer": "document_loaders/web/puppeteer",
  "document_loaders/web/playwright": "document_loaders/web/playwright",
  "document_loaders/web/college_confidential":
    "document_loaders/web/college_confidential",
  "document_loaders/web/gitbook": "document_loaders/web/gitbook",
  "document_loaders/web/hn": "document_loaders/web/hn",
  "document_loaders/web/imsdb": "document_loaders/web/imsdb",
  "document_loaders/web/figma": "document_loaders/web/figma",
  "document_loaders/web/github": "document_loaders/web/github",
  "document_loaders/web/notiondb": "document_loaders/web/notiondb",
  "document_loaders/web/notionapi": "document_loaders/web/notionapi",
  "document_loaders/web/s3": "document_loaders/web/s3",
  "document_loaders/web/sonix_audio": "document_loaders/web/sonix_audio",
  "document_loaders/web/confluence": "document_loaders/web/confluence",
  "document_loaders/web/sort_xyz_blockchain": "document_loaders/web/sort_xyz_blockchain",
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
  // document_transformers
  "document_transformers/openai_functions": "document_transformers/openai_functions",
  // chat_models
  chat_models: "chat_models/index",
  "chat_models/base": "chat_models/base",
  "chat_models/openai": "chat_models/openai",
  "chat_models/anthropic": "chat_models/anthropic",
  "chat_models/googlevertexai": "chat_models/googlevertexai",
  "chat_models/googlepalm": "chat_models/googlepalm",
  "chat_models/baiduwenxin": "chat_models/baiduwenxin",
  // schema
  schema: "schema/index",
  "schema/output_parser": "schema/output_parser",
  "schema/query_constructor": "schema/query_constructor",
  // sql_db
  sql_db: "sql_db",
  // callbacks
  callbacks: "callbacks/index",
  // output_parsers
  output_parsers: "output_parsers/index",
  "output_parsers/expression": "output_parsers/expression",
  // retrievers
  retrievers: "retrievers/index",
  "retrievers/remote": "retrievers/remote/index",
  "retrievers/supabase": "retrievers/supabase",
  "retrievers/zep": "retrievers/zep",
  "retrievers/metal": "retrievers/metal",
  "retrievers/databerry": "retrievers/databerry",
  "retrievers/contextual_compression": "retrievers/contextual_compression",
  "retrievers/document_compressors": "retrievers/document_compressors/index",
  "retrievers/time_weighted": "retrievers/time_weighted",
  "retrievers/document_compressors/chain_extract":
    "retrievers/document_compressors/chain_extract",
  "retrievers/hyde": "retrievers/hyde",
  "retrievers/self_query": "retrievers/self_query/index",
  "retrievers/self_query/chroma": "retrievers/self_query/chroma",
  "retrievers/self_query/functional": "retrievers/self_query/functional",
  "retrievers/self_query/pinecone": "retrievers/self_query/pinecone",
  "retrievers/self_query/supabase": "retrievers/self_query/supabase",
  "retrievers/self_query/weaviate": "retrievers/self_query/weaviate",
  "retrievers/vespa": "retrievers/vespa",
  // cache
  cache: "cache/index",
  "cache/momento": "cache/momento",
  "cache/redis": "cache/redis",
  "cache/upstash_redis": "cache/upstash_redis",
  // stores
  "stores/doc/in_memory": "stores/doc/in_memory",
  "stores/doc/gcs": "stores/doc/gcs",
  "stores/file/in_memory": "stores/file/in_memory",
  "stores/file/node": "stores/file/node",
  "stores/message/in_memory": "stores/message/in_memory",
  "stores/message/dynamodb": "stores/message/dynamodb",
  "stores/message/firestore": "stores/message/firestore",
  "stores/message/momento": "stores/message/momento",
  "stores/message/redis": "stores/message/redis",
  "stores/message/ioredis": "stores/message/ioredis",
  "stores/message/upstash_redis": "stores/message/upstash_redis",
  // experimental
  "experimental/autogpt": "experimental/autogpt/index",
  "experimental/babyagi": "experimental/babyagi/index",
  "experimental/generative_agents": "experimental/generative_agents/index",
  "experimental/plan_and_execute": "experimental/plan_and_execute/index",
  // evaluation
  evaluation: "evaluation/index",
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
  "agents/toolkits/aws_sfn",
  "agents/toolkits/sql",
  "tools/aws_lambda",
  "tools/aws_sfn",
  "tools/calculator",
  "tools/sql",
  "tools/webbrowser",
  "chains/load",
  "chains/sql_db",
  "embeddings/cohere",
  "embeddings/googlevertexai",
  "embeddings/googlepalm",
  "embeddings/tensorflow",
  "embeddings/hf",
  "llms/load",
  "llms/cohere",
  "llms/googlevertexai",
  "llms/googlepalm",
  "llms/hf",
  "llms/replicate",
  "llms/sagemaker_endpoint",
  "prompts/load",
  "vectorstores/chroma",
  "vectorstores/elasticsearch",
  "vectorstores/hnswlib",
  "vectorstores/faiss",
  "vectorstores/weaviate",
  "vectorstores/lancedb",
  "vectorstores/mongo",
  "vectorstores/mongodb_atlas",
  "vectorstores/pinecone",
  "vectorstores/qdrant",
  "vectorstores/supabase",
  "vectorstores/opensearch",
  "vectorstores/typeorm",
  "vectorstores/milvus",
  "vectorstores/myscale",
  "vectorstores/redis",
  "vectorstores/singlestore",
  "vectorstores/typesense",
  "vectorstores/tigris",
  "memory/zep",
  "document_loaders/web/apify_dataset",
  "document_loaders/web/cheerio",
  "document_loaders/web/puppeteer",
  "document_loaders/web/playwright",
  "document_loaders/web/college_confidential",
  "document_loaders/web/gitbook",
  "document_loaders/web/hn",
  "document_loaders/web/imsdb",
  "document_loaders/web/figma",
  "document_loaders/web/github",
  "document_loaders/web/notiondb",
  "document_loaders/web/notionapi",
  "document_loaders/web/s3",
  "document_loaders/web/sonix_audio",
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
  "chat_models/googlevertexai",
  "chat_models/googlepalm",
  "sql_db",
  "retrievers/supabase",
  "retrievers/zep",
  "retrievers/metal",
  "retrievers/self_query",
  "retrievers/self_query/chroma",
  "retrievers/self_query/functional",
  "retrievers/self_query/pinecone",
  "retrievers/self_query/supabase",
  "retrievers/self_query/weaviate",
  "output_parsers/expression",
  "chains/query_constructor",
  "chains/query_constructor/ir",
  "cache/momento",
  "cache/redis",
  "cache/upstash_redis",
  "stores/doc/gcs",
  "stores/file/node",
  "stores/message/dynamodb",
  "stores/message/firestore",
  "stores/message/momento",
  "stores/message/redis",
  "stores/message/ioredis",
  "stores/message/upstash_redis",
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
    "test-exports-esbuild",
    (p) => `import * as ${p.replace(/\//g, "_")} from "langchain/${p}";`,
  ],
  [
    "test-exports-cjs",
    (p) => `const ${p.replace(/\//g, "_")} = require("langchain/${p}");`,
  ],
  ["test-exports-cf", (p) => `export * from "langchain/${p}";`],
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

// Tuple describing the auto-generated import map (used by langchain/load)
// [package name, import statement, import map path]
// This will not include entrypoints deprecated or requiring optional deps.
const importMap = [
  "langchain",
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
  "langchain",
  (k, p) =>
    `  "langchain/${k}"?:
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
  "langchain",
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
    entrypointsToInclude
      .map((key) => importStatement(key, entrypoints[key]))
      .join(",\n") + ",\n];\n";
  fs.writeFileSync(
    `../${pkg}/${importConstantsPath}`,
    "// Auto-generated by `scripts/create-entrypoints.js`. Do not edit manually.\n\nexport const optionalImportEntrypoints = [\n" +
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
