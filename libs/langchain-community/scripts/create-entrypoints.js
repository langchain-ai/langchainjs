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
  // tools
  "load/serializable": "load/serializable",
  "tools/aiplugin": "tools/aiplugin",
  "tools/aws_lambda": "tools/aws_lambda",
  "tools/aws_sfn": "tools/aws_sfn",
  "tools/bingserpapi": "tools/bingserpapi",
  "tools/brave_search": "tools/brave_search",
  "tools/connery": "tools/connery",
  "tools/dadjokeapi": "tools/dadjokeapi",
  "tools/discord": "tools/discord",
  "tools/dynamic": "tools/dynamic",
  "tools/dataforseo_api_search": "tools/dataforseo_api_search",
  "tools/gmail": "tools/gmail/index",
  "tools/google_custom_search": "tools/google_custom_search",
  "tools/google_places": "tools/google_places",
  "tools/ifttt": "tools/ifttt",
  "tools/searchapi": "tools/searchapi",
  "tools/searxng_search": "tools/searxng_search",
  "tools/serpapi": "tools/serpapi",
  "tools/serper": "tools/serper",
  "tools/wikipedia_query_run": "tools/wikipedia_query_run",
  "tools/wolframalpha": "tools/wolframalpha",
  // toolkits
  "agents/toolkits/aws_sfn": "agents/toolkits/aws_sfn",
  "agents/toolkits/base": "agents/toolkits/base",
  "agents/toolkits/connery": "agents/toolkits/connery/index",
  // embeddings
  "embeddings/bedrock": "embeddings/bedrock",
  "embeddings/cloudflare_workersai": "embeddings/cloudflare_workersai",
  "embeddings/cohere": "embeddings/cohere",
  "embeddings/googlepalm": "embeddings/googlepalm",
  "embeddings/googlevertexai": "embeddings/googlevertexai",
  "embeddings/gradient_ai": "embeddings/gradient_ai",
  "embeddings/hf": "embeddings/hf",
  "embeddings/hf_transformers": "embeddings/hf_transformers",
  "embeddings/llama_cpp": "embeddings/llama_cpp",
  "embeddings/minimax": "embeddings/minimax",
  "embeddings/ollama": "embeddings/ollama",
  "embeddings/tensorflow": "embeddings/tensorflow",
  "embeddings/voyage": "embeddings/voyage",
  // llms
  "llms/ai21": "llms/ai21",
  "llms/aleph_alpha": "llms/aleph_alpha",
  "llms/bedrock": "llms/bedrock/index",
  "llms/bedrock/web": "llms/bedrock/web",
  "llms/cloudflare_workersai": "llms/cloudflare_workersai",
  "llms/cohere": "llms/cohere",
  "llms/fireworks": "llms/fireworks",
  "llms/googlepalm": "llms/googlepalm",
  "llms/googlevertexai": "llms/googlevertexai/index",
  "llms/googlevertexai/web": "llms/googlevertexai/web",
  "llms/gradient_ai": "llms/gradient_ai",
  "llms/hf": "llms/hf",
  "llms/llama_cpp": "llms/llama_cpp",
  "llms/ollama": "llms/ollama",
  "llms/portkey": "llms/portkey",
  "llms/raycast": "llms/raycast",
  "llms/replicate": "llms/replicate",
  "llms/sagemaker_endpoint": "llms/sagemaker_endpoint",
  "llms/togetherai": "llms/togetherai",
  "llms/watsonx_ai": "llms/watsonx_ai",
  "llms/writer": "llms/writer",
  "llms/yandex": "llms/yandex",
  // vectorstores
  "vectorstores/analyticdb": "vectorstores/analyticdb",
  "vectorstores/cassandra": "vectorstores/cassandra",
  "vectorstores/chroma": "vectorstores/chroma",
  "vectorstores/clickhouse": "vectorstores/clickhouse",
  "vectorstores/closevector/node": "vectorstores/closevector/node",
  "vectorstores/closevector/web": "vectorstores/closevector/web",
  "vectorstores/cloudflare_vectorize": "vectorstores/cloudflare_vectorize",
  "vectorstores/convex": "vectorstores/convex",
  "vectorstores/elasticsearch": "vectorstores/elasticsearch",
  "vectorstores/faiss": "vectorstores/faiss",
  "vectorstores/googlevertexai": "vectorstores/googlevertexai",
  "vectorstores/hnswlib": "vectorstores/hnswlib",
  "vectorstores/lancedb": "vectorstores/lancedb",
  "vectorstores/milvus": "vectorstores/milvus",
  "vectorstores/momento_vector_index": "vectorstores/momento_vector_index",
  "vectorstores/mongodb_atlas": "vectorstores/mongodb_atlas",
  "vectorstores/myscale": "vectorstores/myscale",
  "vectorstores/neo4j_vector": "vectorstores/neo4j_vector",
  "vectorstores/opensearch": "vectorstores/opensearch",
  "vectorstores/pgvector": "vectorstores/pgvector",
  "vectorstores/pinecone": "vectorstores/pinecone",
  "vectorstores/prisma": "vectorstores/prisma",
  "vectorstores/qdrant": "vectorstores/qdrant",
  "vectorstores/redis": "vectorstores/redis",
  "vectorstores/rockset": "vectorstores/rockset",
  "vectorstores/singlestore": "vectorstores/singlestore",
  "vectorstores/supabase": "vectorstores/supabase",
  "vectorstores/tigris": "vectorstores/tigris",
  "vectorstores/typeorm": "vectorstores/typeorm",
  "vectorstores/typesense": "vectorstores/typesense",
  "vectorstores/usearch": "vectorstores/usearch",
  "vectorstores/vectara": "vectorstores/vectara",
  "vectorstores/vercel_postgres": "vectorstores/vercel_postgres",
  "vectorstores/voy": "vectorstores/voy",
  "vectorstores/weaviate": "vectorstores/weaviate",
  "vectorstores/xata": "vectorstores/xata",
  "vectorstores/zep": "vectorstores/zep",
  // chat_models
  "chat_models/baiduwenxin": "chat_models/baiduwenxin",
  "chat_models/bedrock": "chat_models/bedrock/index",
  "chat_models/bedrock/web": "chat_models/bedrock/web",
  "chat_models/cloudflare_workersai": "chat_models/cloudflare_workersai",
  "chat_models/fireworks": "chat_models/fireworks",
  "chat_models/googlevertexai": "chat_models/googlevertexai/index",
  "chat_models/googlevertexai/web": "chat_models/googlevertexai/web",
  "chat_models/googlepalm": "chat_models/googlepalm",
  "chat_models/iflytek_xinghuo": "chat_models/iflytek_xinghuo/index",
  "chat_models/iflytek_xinghuo/web": "chat_models/iflytek_xinghuo/web",
  "chat_models/llama_cpp": "chat_models/llama_cpp",
  "chat_models/minimax": "chat_models/minimax",
  "chat_models/ollama": "chat_models/ollama",
  "chat_models/portkey": "chat_models/portkey",
  "chat_models/yandex": "chat_models/yandex",
  // callbacks
  "callbacks/handlers/llmonitor": "callbacks/handlers/llmonitor",
  // retrievers
  "retrievers/amazon_kendra": "retrievers/amazon_kendra",
  "retrievers/chaindesk": "retrievers/chaindesk",
  "retrievers/databerry": "retrievers/databerry",
  "retrievers/metal": "retrievers/metal",
  "retrievers/supabase": "retrievers/supabase",
  "retrievers/tavily_search_api": "retrievers/tavily_search_api",
  "retrievers/zep": "retrievers/zep",
  // cache
  "caches/cloudflare_kv": "caches/cloudflare_kv",
  "caches/ioredis": "caches/ioredis",
  "caches/momento": "caches/momento",
  "caches/upstash_redis": "caches/upstash_redis",
  // graphs
  "graphs/neo4j_graph": "graphs/neo4j_graph",
  "utils/event_source_parse": "utils/event_source_parse",
  // document transformers
  "document_transformers/html_to_text": "document_transformers/html_to_text",
  "document_transformers/mozilla_readability":
    "document_transformers/mozilla_readability",
  // storage
  "storage/convex": "storage/convex",
  "storage/ioredis": "storage/ioredis",
  "storage/upstash_redis": "storage/upstash_redis",
  "storage/vercel_kv": "storage/vercel_kv",
  // stores
  "stores/doc/base": "stores/doc/base",
  "stores/doc/in_memory": "stores/doc/in_memory",
  "stores/message/cassandra": "stores/message/cassandra",
  "stores/message/cloudflare_d1": "stores/message/cloudflare_d1",
  "stores/message/convex": "stores/message/convex",
  "stores/message/dynamodb": "stores/message/dynamodb",
  "stores/message/firestore": "stores/message/firestore",
  "stores/message/in_memory": "stores/message/in_memory",
  "stores/message/ioredis": "stores/message/ioredis",
  "stores/message/momento": "stores/message/momento",
  "stores/message/mongodb": "stores/message/mongodb",
  "stores/message/planetscale": "stores/message/planetscale",
  "stores/message/redis": "stores/message/redis",
  "stores/message/upstash_redis": "stores/message/upstash_redis",
  "stores/message/xata": "stores/message/xata",
  // memory
  "memory/chat_memory": "memory/chat_memory",
  "memory/motorhead_memory": "memory/motorhead_memory",
  "memory/zep": "memory/zep",
  "util/convex": "utils/convex",
};

// Entrypoints in this list will
// 1. Be excluded from the documentation
// 2. Be only available in Node.js environments (for backwards compatibility)
const deprecatedNodeOnly = [];

// Entrypoints in this list require an optional dependency to be installed.
// Therefore they are not tested in the generated test-exports-* packages.
const requiresOptionalDependency = [
  "tools/aws_sfn",
  "tools/aws_lambda",
  "tools/discord",
  "tools/gmail",
  "agents/toolkits/aws_sfn",
  "callbacks/handlers/llmonitor",
  "embeddings/bedrock",
  "embeddings/cloudflare_workersai",
  "embeddings/cohere",
  "embeddings/googlevertexai",
  "embeddings/googlepalm",
  "embeddings/tensorflow",
  "embeddings/hf",
  "embeddings/hf_transformers",
  "embeddings/llama_cpp",
  "embeddings/gradient_ai",
  "llms/load",
  "llms/cohere",
  "llms/googlevertexai",
  "llms/googlevertexai/web",
  "llms/googlepalm",
  "llms/gradient_ai",
  "llms/hf",
  "llms/raycast",
  "llms/replicate",
  "llms/sagemaker_endpoint",
  "llms/watsonx_ai",
  "llms/bedrock",
  "llms/bedrock/web",
  "llms/llama_cpp",
  "llms/writer",
  "llms/portkey",
  "vectorstores/analyticdb",
  "vectorstores/cassandra",
  "vectorstores/chroma",
  "vectorstores/clickhouse",
  "vectorstores/closevector/node",
  "vectorstores/closevector/web",
  "vectorstores/cloudflare_vectorize",
  "vectorstores/convex",
  "vectorstores/elasticsearch",
  "vectorstores/faiss",
  "vectorstores/googlevertexai",
  "vectorstores/hnswlib",
  "vectorstores/lancedb",
  "vectorstores/milvus",
  "vectorstores/momento_vector_index",
  "vectorstores/mongodb_atlas",
  "vectorstores/myscale",
  "vectorstores/neo4j_vector",
  "vectorstores/opensearch",
  "vectorstores/pgvector",
  "vectorstores/pinecone",
  "vectorstores/qdrant",
  "vectorstores/redis",
  "vectorstores/rockset",
  "vectorstores/singlestore",
  "vectorstores/supabase",
  "vectorstores/tigris",
  "vectorstores/typeorm",
  "vectorstores/typesense",
  "vectorstores/usearch",
  "vectorstores/vercel_postgres",
  "vectorstores/voy",
  "vectorstores/weaviate",
  "vectorstores/xata",
  "vectorstores/zep",
  "chat_models/bedrock",
  "chat_models/bedrock/web",
  "chat_models/googlevertexai",
  "chat_models/googlevertexai/web",
  "chat_models/googlepalm",
  "chat_models/llama_cpp",
  "chat_models/portkey",
  "chat_models/iflytek_xinghuo",
  "chat_models/iflytek_xinghuo/web",
  "retrievers/amazon_kendra",
  "retrievers/supabase",
  "retrievers/zep",
  "retrievers/metal",
  "cache/cloudflare_kv",
  "cache/momento",
  "cache/upstash_redis",
  "graphs/neo4j_graph",
  // document_transformers
  "document_transformers/html_to_text",
  "document_transformers/mozilla_readability",
  // storage
  "storage/convex",
  "storage/ioredis",
  "storage/upstash_redis",
  "storage/vercel_kv",
  // stores
  "stores/message/cassandra",
  "stores/message/cloudflare_d1",
  "stores/message/convex",
  "stores/message/dynamodb",
  "stores/message/firestore",
  "stores/message/ioredis",
  "stores/message/momento",
  "stores/message/mongodb",
  "stores/message/planetscale",
  "stores/message/redis",
  "stores/message/upstash_redis",
  "stores/message/xata",
  // memory
  "memory/motorhead_memory",
  "memory/zep",
  "util/convex",
];

const updateJsonFile = (relativePath, updateFunction) => {
  const contents = fs.readFileSync(relativePath).toString();
  const res = updateFunction(JSON.parse(contents));
  fs.writeFileSync(relativePath, JSON.stringify(res, null, 2) + "\n");
};

const generateFiles = () => {
  const files = [...Object.entries(entrypoints)].flatMap(([key, value]) => {
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
  });

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

  // Update test-exports-*/entrypoints.js
  const entrypointsToTest = Object.keys(entrypoints)
    .filter((key) => !deprecatedNodeOnly.includes(key))
    .filter((key) => !requiresOptionalDependency.includes(key));
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
  "langchain-community",
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
  "langchain-community",
  (k, p) =>
    `  "@langchain/community/${k}"?:
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
  "langchain-community",
  (k) => `  "langchain_community/${k}"`,
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
