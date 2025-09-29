import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * @param {string} relativePath
 * @returns {string}
 */
function abs(relativePath) {
  return resolve(dirname(fileURLToPath(import.meta.url)), relativePath);
}

export const config = {
  internals: [
    /node\:/,
    /js-tiktoken/,
    /@langchain\/core/,
    /langsmith/,
    /@langchain\/community/,
    "axios", // axios is a dependency of openai
    "mysql2/promise",
    "notion-to-md/build/utils/notion.js"
  ],
  entrypoints: {
    load: "load/index",
    "load/serializable": "load/serializable",
    // agents
    agents: "agents/index",
    "agents/load": "agents/load",
    "agents/toolkits": "agents/toolkits/index",
    "agents/toolkits/sql": "agents/toolkits/sql/index",
    "agents/format_scratchpad": "agents/format_scratchpad/openai_functions",
    "agents/format_scratchpad/openai_tools":
      "agents/format_scratchpad/openai_tools",
    "agents/format_scratchpad/log": "agents/format_scratchpad/log",
    "agents/format_scratchpad/xml": "agents/format_scratchpad/xml",
    "agents/format_scratchpad/log_to_message":
      "agents/format_scratchpad/log_to_message",
    "agents/react/output_parser": "agents/react/output_parser",
    "agents/xml/output_parser": "agents/xml/output_parser",
    "agents/openai/output_parser": "agents/openai/output_parser",
    // tools
    tools: "tools/index",
    "tools/chain": "tools/chain",
    "tools/render": "tools/render",
    "tools/retriever": "tools/retriever",
    "tools/sql": "tools/sql",
    "tools/webbrowser": "tools/webbrowser",
    // chains
    chains: "chains/index",
    "chains/combine_documents": "chains/combine_documents/index",
    "chains/combine_documents/reduce": "chains/combine_documents/reduce",
    "chains/history_aware_retriever": "chains/history_aware_retriever",
    "chains/load": "chains/load",
    "chains/openai_functions": "chains/openai_functions/index",
    "chains/query_constructor": "chains/query_constructor/index",
    "chains/query_constructor/ir": "chains/query_constructor/ir",
    "chains/retrieval": "chains/retrieval",
    "chains/sql_db": "chains/sql_db/index",
    "chains/graph_qa/cypher": "chains/graph_qa/cypher",
    // chat models
    "chat_models/universal": "chat_models/universal",
    // embeddings
    "embeddings/cache_backed": "embeddings/cache_backed",
    "embeddings/fake": "embeddings/fake",
    // vectorstores
    "vectorstores/memory": "vectorstores/memory",
    // text_splitter
    text_splitter: "text_splitter",
    // memory
    "memory": "memory/index",
    "memory/chat_memory": "memory/chat_memory",
    // document
    document: "document",
    // document_loaders
    "document_loaders/base": "document_loaders/base",
    "document_loaders/fs/buffer": "document_loaders/fs/buffer",
    "document_loaders/fs/directory": "document_loaders/fs/directory",
    "document_loaders/fs/json": "document_loaders/fs/json",
    "document_loaders/fs/multi_file": "document_loaders/fs/multi_file",
    "document_loaders/fs/text": "document_loaders/fs/text",
    // document_transformers
    "document_transformers/openai_functions":
      "document_transformers/openai_functions",
    // sql_db
    sql_db: "sql_db",
    // callbacks
    callbacks: "callbacks/index",
    // output_parsers
    output_parsers: "output_parsers/index",
    "output_parsers/expression": "output_parsers/expression",
    // retrievers
    "retrievers/contextual_compression": "retrievers/contextual_compression",
    "retrievers/document_compressors": "retrievers/document_compressors/index",
    "retrievers/ensemble": "retrievers/ensemble",
    "retrievers/multi_query": "retrievers/multi_query",
    "retrievers/multi_vector": "retrievers/multi_vector",
    "retrievers/parent_document": "retrievers/parent_document",
    "retrievers/time_weighted": "retrievers/time_weighted",
    "retrievers/document_compressors/chain_extract":
      "retrievers/document_compressors/chain_extract",
    "retrievers/document_compressors/embeddings_filter":
      "retrievers/document_compressors/embeddings_filter",
    "retrievers/hyde": "retrievers/hyde",
    "retrievers/score_threshold": "retrievers/score_threshold",
    "retrievers/self_query": "retrievers/self_query/index",
    "retrievers/self_query/functional": "retrievers/self_query/functional",
    "retrievers/matryoshka_retriever": "retrievers/matryoshka_retriever",
    // cache
    "cache/file_system": "cache/file_system",
    // stores
    "stores/doc/base": "stores/doc/base",
    "stores/doc/in_memory": "stores/doc/in_memory",
    "stores/file/in_memory": "stores/file/in_memory",
    "stores/file/node": "stores/file/node",
    "stores/message/in_memory": "stores/message/in_memory",
    // storage
    "storage/encoder_backed": "storage/encoder_backed",
    "storage/in_memory": "storage/in_memory",
    "storage/file_system": "storage/file_system",
    // hub
    hub: "hub/index",
    "hub/node": "hub/node",
    // utilities
    "util/document": "util/document",
    "util/math": "util/math",
    "util/time": "util/time",
    // experimental
    "experimental/autogpt": "experimental/autogpt/index",
    "experimental/openai_assistant": "experimental/openai_assistant/index",
    "experimental/openai_files": "experimental/openai_files/index",
    "experimental/babyagi": "experimental/babyagi/index",
    "experimental/generative_agents": "experimental/generative_agents/index",
    "experimental/plan_and_execute": "experimental/plan_and_execute/index",
    "experimental/chains/violation_of_expectations":
      "experimental/chains/violation_of_expectations/index",
    "experimental/masking": "experimental/masking/index",
    "experimental/prompts/custom_format": "experimental/prompts/custom_format",
    "experimental/prompts/handlebars": "experimental/prompts/handlebars",
    // evaluation
    evaluation: "evaluation/index",
    // smith (LangSmith Evaluation)
    smith: "smith/index",
    // runnables
    "runnables/remote": "runnables/remote",
    // indexes
    indexes: "indexes/index",
    "schema/query_constructor": "schema/query_constructor",
    "schema/prompt_template": "schema/prompt_template",
  },
  deprecatedOmitFromImportMap: [
    "document",
    "load/serializable",
    "runnables",
  ],
  requiresOptionalDependency: [
    "agents/load",
    "agents/toolkits/sql",
    "tools/sql",
    "tools/webbrowser",
    "chains/load",
    "chains/sql_db",
    "chains/graph_qa/cypher",
    "chat_models/universal",
    "llms/load",
    "prompts/load",
    "memory/zep",
    "document_loaders/web/apify_dataset",
    "document_loaders/web/assemblyai",
    "document_loaders/web/azure_blob_storage_container",
    "document_loaders/web/azure_blob_storage_file",
    "document_loaders/web/browserbase",
    "document_loaders/web/cheerio",
    "document_loaders/web/puppeteer",
    "document_loaders/web/playwright",
    "document_loaders/web/college_confidential",
    "document_loaders/web/gitbook",
    "document_loaders/web/hn",
    "document_loaders/web/imsdb",
    "document_loaders/web/figma",
    "document_loaders/web/firecrawl",
    "document_loaders/web/github",
    "document_loaders/web/pdf",
    "document_loaders/web/notiondb",
    "document_loaders/web/notionapi",
    "document_loaders/web/recursive_url",
    "document_loaders/web/s3",
    "document_loaders/web/sitemap",
    "document_loaders/web/sonix_audio",
    "document_loaders/web/confluence",
    "document_loaders/web/couchbase",
    "document_loaders/web/youtube",
    "document_loaders/fs/directory",
    "document_loaders/fs/multi_file",
    "document_loaders/fs/buffer",
    "document_loaders/fs/chatgpt",
    "document_loaders/fs/text",
    "document_loaders/fs/json",
    "document_loaders/fs/srt",
    "document_loaders/fs/pdf",
    "document_loaders/fs/docx",
    "document_loaders/fs/epub",
    "document_loaders/fs/csv",
    "document_loaders/fs/notion",
    "document_loaders/fs/obsidian",
    "document_loaders/fs/unstructured",
    "document_loaders/fs/openai_whisper_audio",
    "document_loaders/fs/pptx",
    "document_transformers/html_to_text",
    "document_transformers/mozilla_readability",
    "sql_db",
    "retrievers/self_query",
    "retrievers/self_query/functional",
    "output_parsers/expression",
    "chains/query_constructor",
    "chains/query_constructor/ir",
    "cache/file_system",
    "stores/file/node",
    "storage/file_system",
    // Prevent export due to circular dependency with "load" entrypoint
    "hub",
    "hub/node",
    "experimental/prompts/handlebars",
  ],
  extraImportMapEntries: [
    {
      modules: ["ChatOpenAI"],
      alias: ["chat_models", "openai"],
      path: "@langchain/openai",
    },
    {
      modules: ["AzureChatOpenAI"],
      alias: ["chat_models", "azure_openai"],
      path: "@langchain/openai",
    },
    {
      modules: ["OpenAI"],
      alias: ["llms", "openai"],
      path: "@langchain/openai",
    },
    {
      modules: ["AzureOpenAI"],
      alias: ["llms", "azure_openai"],
      path: "@langchain/openai",
    },
    {
      modules: ["OpenAIEmbeddings"],
      alias: ["embeddings", "openai"],
      path: "@langchain/openai",
    },
    {
      modules: ["AzureOpenAIEmbeddings"],
      alias: ["embeddings", "azure_openai"],
      path: "@langchain/openai",
    },
    {
      modules: ["PromptTemplate"],
      alias: ["prompts", "prompt"],
      path: "@langchain/core/prompts",
    },
    {
      modules: [
        "AIMessage",
        "AIMessageChunk",
        "BaseMessage",
        "BaseMessageChunk",
        "ChatMessage",
        "ChatMessageChunk",
        "FunctionMessage",
        "FunctionMessageChunk",
        "HumanMessage",
        "HumanMessageChunk",
        "SystemMessage",
        "SystemMessageChunk",
        "ToolMessage",
        "ToolMessageChunk",
      ],
      alias: ["schema", "messages"],
      path: "@langchain/core/messages",
    },
    {
      modules: [
        "AIMessage",
        "AIMessageChunk",
        "BaseMessage",
        "BaseMessageChunk",
        "ChatMessage",
        "ChatMessageChunk",
        "FunctionMessage",
        "FunctionMessageChunk",
        "HumanMessage",
        "HumanMessageChunk",
        "SystemMessage",
        "SystemMessageChunk",
        "ToolMessage",
        "ToolMessageChunk",
      ],
      alias: ["schema"],
      path: "@langchain/core/messages",
    },
    {
      modules: [
        "AIMessagePromptTemplate",
        "ChatMessagePromptTemplate",
        "ChatPromptTemplate",
        "HumanMessagePromptTemplate",
        "MessagesPlaceholder",
        "SystemMessagePromptTemplate",
      ],
      alias: ["prompts", "chat"],
      path: "@langchain/core/prompts",
    },
    {
      modules: [
        "ImagePromptTemplate",
      ],
      alias: ["prompts", "image"],
      path: "@langchain/core/prompts",
    },
    {
      modules: ["PipelinePromptTemplate"],
      alias: ["prompts", "pipeline"],
      path: "@langchain/core/prompts",
    },
    {
      modules: ["StringPromptValue"],
      alias: ["prompts", "base"],
      path: "@langchain/core/prompt_values",
    },
    {
      modules: [
        "RouterRunnable",
        "RunnableAssign",
        "RunnableBinding",
        "RunnableBranch",
        "RunnableEach",
        "RunnableMap",
        "RunnableParallel",
        "RunnablePassthrough",
        "RunnablePick",
        "RunnableRetry",
        "RunnableSequence",
        "RunnableWithFallbacks",
        "RunnableWithMessageHistory",
      ],
      alias: ["schema", "runnable"],
      path: "@langchain/core/runnables",
    },
    {
      modules: ["StringOutputParser"],
      alias: ["schema", "output_parser"],
      path: "@langchain/core/output_parsers",
    },
    {
      modules: ["ChatGenerationChunk", "GenerationChunk"],
      alias: ["schema", "output"],
      path: "@langchain/core/outputs",
    },
    {
      modules: ["Client"],
      alias: ["langsmith"],
      path: "langsmith",
    }
  ],
  shouldTestExports: true,
  tsConfigPath: resolve("./tsconfig.json"),
  cjsSource: "./dist-cjs",
  cjsDestination: "./dist",
  abs,
};
