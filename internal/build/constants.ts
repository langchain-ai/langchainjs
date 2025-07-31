/**
 * These are special
 */

export const optionalEntrypoints: Record<string, string[]> = {
  langchain: [
    "agents/load",
    "agents/toolkits/sql",
    "tools/sql",
    "tools/webbrowser",
    "chains/load",
    "chains/query_constructor",
    "chains/query_constructor/ir",
    "chains/sql_db",
    "chains/graph_qa/cypher",
    "chat_models/universal",
    "document_loaders/fs/buffer",
    "document_loaders/fs/directory",
    "document_loaders/fs/json",
    "document_loaders/fs/multi_file",
    "document_loaders/fs/text",
    "sql_db",
    "output_parsers/expression",
    "retrievers/self_query",
    "retrievers/self_query/functional",
    "cache/file_system",
    "stores/file/node",
    "storage/file_system",
    "hub",
    "hub/node",
    "experimental/prompts/handlebars",
  ],
};

export const deprecatedOmitFromImportMap: Record<string, string[]> = {
  langchain: [
    "hub",
    "hub/node",
  ],
};

export const extraImportMapEntries: Record<
  string,
  {
    modules: string[];
    alias: string[];
    path: string;
  }[]
> = {
  langchain: [
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
      modules: ["ImagePromptTemplate"],
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
  ],
};
