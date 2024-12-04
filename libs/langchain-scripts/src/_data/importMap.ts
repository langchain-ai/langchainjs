export type DeprecatedEntrypoint = {
  old: string;
  new: string;
  namedImport: string | null;
};

export const importMap: Array<DeprecatedEntrypoint> = [
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "MaxMarginalRelevanceSearchOptions",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "VectorStoreRetrieverMMRSearchKwargs",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "VectorStoreRetrieverInput",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "VectorStoreRetrieverInterface",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "VectorStoreRetriever",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "VectorStoreInterface",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "VectorStore",
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: "SaveableVectorStore",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/core/tools",
    namedImport: "ToolParams",
  },
  {
    old: "langchain/tools/base",
    new: "@langchain/core/tools",
    namedImport: "ToolInputParsingException",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/core/tools",
    namedImport: "StructuredTool",
  },
  {
    old: "langchain/tools",
    new: "@langchain/core/tools",
    namedImport: "Tool",
  },
  {
    old: "langchain/tools/dynamic",
    new: "@langchain/core/tools",
    namedImport: "BaseDynamicToolInput",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/core/tools",
    namedImport: "DynamicToolInput",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/core/tools",
    namedImport: "DynamicStructuredToolInput",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/core/tools",
    namedImport: "DynamicTool",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/core/tools",
    namedImport: "DynamicStructuredTool",
  },
  {
    old: "langchain/schema/storage",
    new: "@langchain/core/stores",
    namedImport: "BaseStoreInterface",
  },
  {
    old: "langchain/schema/storage",
    new: "@langchain/core/stores",
    namedImport: "BaseStore",
  },
  {
    old: "langchain/storage/in_memory",
    new: "@langchain/core/stores",
    namedImport: "InMemoryStore",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/prompt_values",
    namedImport: "BasePromptValue",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompt_values",
    namedImport: "StringPromptValue",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompt_values",
    namedImport: "ChatPromptValueFields",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompt_values",
    namedImport: "ChatPromptValue",
  },
  {
    old: "langchain/schema",
    new: "@langchain/core/outputs",
    namedImport: "LLMResult",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "RUN_KEY",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "Generation",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "GenerationChunkFields",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "GenerationChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "LLMResult",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "ChatGeneration",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "ChatGenerationChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/outputs",
    namedImport: "ChatResult",
  },
  {
    old: "langchain/memory/base",
    new: "@langchain/core/memory",
    namedImport: "getPromptInputKey",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/core/memory",
    namedImport: "OutputValues",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/core/memory",
    namedImport: "MemoryVariables",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/core/memory",
    namedImport: "BaseMemory",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/core/memory",
    namedImport: "getInputValue",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/core/memory",
    namedImport: "getOutputValue",
  },
  {
    old: "langchain/embeddings/base",
    new: "@langchain/core/embeddings",
    namedImport: "EmbeddingsParams",
  },
  {
    old: "langchain/embeddings/base",
    new: "@langchain/core/embeddings",
    namedImport: "EmbeddingsInterface",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/chat_history",
    namedImport: "BaseChatMessageHistory",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/chat_history",
    namedImport: "BaseListChatMessageHistory",
  },
  {
    old: "langchain/cache/base",
    new: "@langchain/core/caches",
    namedImport: "deserializeStoredGeneration",
  },
  {
    old: "langchain/cache/base",
    new: "@langchain/core/caches",
    namedImport: "serializeGeneration",
  },
  {
    old: "langchain/cache/base",
    new: "@langchain/core/caches",
    namedImport: "getCacheKey",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/caches",
    namedImport: "BaseCache",
  },
  {
    old: "langchain/cache/*",
    new: "@langchain/core/caches",
    namedImport: "InMemoryCache",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/agents",
    namedImport: "AgentAction",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/agents",
    namedImport: "AgentFinish",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/agents",
    namedImport: "AgentStep",
  },
  {
    old: "langchain/util/tiktoken",
    new: "@langchain/core/utils/tiktoken",
    namedImport: "getEncoding",
  },
  {
    old: "langchain/util/tiktoken",
    new: "@langchain/core/utils/tiktoken",
    namedImport: "encodingForModel",
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: "atee",
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: "concat",
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: "pipeGeneratorWithSetup",
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: "IterableReadableStreamInterface",
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: "IterableReadableStream",
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: "AsyncGeneratorWithSetup",
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: "matrixFunc",
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: "normalize",
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: "cosineSimilarity",
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: "innerProduct",
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: "euclideanDistance",
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: "maximalMarginalRelevance",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/core/utils/event_source_parse",
    namedImport: "getBytes",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/core/utils/event_source_parse",
    namedImport: "getLines",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/core/utils/event_source_parse",
    namedImport: "getMessages",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/core/utils/event_source_parse",
    namedImport: "convertEventStreamToIterableReadableDataStream",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/core/utils/event_source_parse",
    namedImport: "EventStreamContentType",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/core/utils/event_source_parse",
    namedImport: "EventSourceMessage",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "getRuntimeEnvironment",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "getEnvironmentVariable",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "isBrowser",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "isWebWorker",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "isJsDom",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "isDeno",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "isNode",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "getEnv",
  },
  {
    old: "langchain/util/env",
    new: "@langchain/core/utils/env",
    namedImport: "RuntimeEnvironment",
  },
  {
    old: "langchain/util/async_caller",
    new: "@langchain/core/utils/async_caller",
    namedImport: "FailedAttemptHandler",
  },
  {
    old: "langchain/util/async_caller",
    new: "@langchain/core/utils/async_caller",
    namedImport: "AsyncCallerParams",
  },
  {
    old: "langchain/util/async_caller",
    new: "@langchain/core/utils/async_caller",
    namedImport: "AsyncCallerCallOptions",
  },
  {
    old: "langchain/util/async_caller",
    new: "@langchain/core/utils/async_caller",
    namedImport: "AsyncCaller",
  },
  {
    old: "langchain/util/types",
    new: "@langchain/core/utils/types",
    namedImport: "StringWithAutocomplete",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/utils/types",
    namedImport: "InputValues",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/utils/types",
    namedImport: "PartialValues",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/utils/types",
    namedImport: "ChainValues",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeSplitIntoListParser",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeRunnable",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeLLM",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeStreamingLLM",
  },
  {
    old: "langchain/smith/tests/runner_utils.int.test",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeChatModel",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeStreamingChatModel",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeRetriever",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeChatInput",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeListChatModel",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeChatMessageHistory",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeListChatMessageHistory",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeTracer",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeToolParams",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeTool",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "FakeEmbeddings",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "SyntheticEmbeddings",
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: "SingleRunExtractor",
  },
  {
    old: "langchain/util/axios-fetch-adapter.d",
    new: "@langchain/core/utils/fast-json-patch",
    namedImport: "default",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/utils/fast-json-patch",
    namedImport: "Operation",
  },
  {
    old: "langchain/types/type-utils",
    new: "@langchain/core/types/type-utils",
    namedImport: "Optional",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/tracer_langchain",
    namedImport: "Run",
  },
  {
    old: "langchain/callbacks/handlers/tracer_langchain",
    new: "@langchain/core/tracers/tracer_langchain",
    namedImport: "RunCreate2",
  },
  {
    old: "langchain/callbacks/handlers/tracer_langchain",
    new: "@langchain/core/tracers/tracer_langchain",
    namedImport: "RunUpdate",
  },
  {
    old: "langchain/callbacks/handlers/tracer_langchain",
    new: "@langchain/core/tracers/tracer_langchain",
    namedImport: "LangChainTracerFields",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/tracer_langchain",
    namedImport: "LangChainTracer",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/run_collector",
    namedImport: "RunCollectorCallbackHandler",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "LogEntry",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "RunState",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "RunLogPatch",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "RunLog",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "StreamEventData",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "StreamEvent",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "SchemaFormat",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "LogStreamCallbackHandlerInput",
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: "LogStreamCallbackHandler",
  },
  {
    old: "langchain/callbacks/handlers/initialize",
    new: "@langchain/core/tracers/initialize",
    namedImport: "getTracingCallbackHandler",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/initialize",
    namedImport: "getTracingV2CallbackHandler",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/console",
    namedImport: "ConsoleCallbackHandler",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/base",
    namedImport: "RunType",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/base",
    namedImport: "Run",
  },
  {
    old: "langchain/callbacks/handlers/tracer",
    new: "@langchain/core/tracers/base",
    namedImport: "AgentRun",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/tracers/base",
    namedImport: "BaseTracer",
  },
  {
    old: "langchain/retrievers/self_query/base",
    new: "@langchain/core/structured_query",
    namedImport: "TranslatorOpts",
  },
  {
    old: "@langchain/community/retrievers/self_query/qdrant",
    new: "@langchain/community/structured_query/qdrant",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/self_query/chroma",
    new: "@langchain/community/structured_query/chroma",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/self_query/pinecone",
    new: "@langchain/pinecone",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/self_query/supabase",
    new: "@langchain/community/structured_query/supabase",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/self_query/supabase_utils",
    new: "@langchain/community/structured_query/supabase_utils",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/self_query/*",
    new: "@langchain/core/structured_query",
    namedImport: "BaseTranslator",
  },
  {
    old: "langchain/retrievers/self_query/*",
    new: "@langchain/core/structured_query",
    namedImport: "BasicTranslator",
  },
  {
    old: "langchain/retrievers/self_query/functional",
    new: "@langchain/core/structured_query",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/self_query/*",
    new: "@langchain/core/structured_query",
    namedImport: "FunctionalTranslator",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "AND",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "OR",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "NOT",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Operator",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "EQ",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "NE",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "LT",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "GT",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "LTE",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "GTE",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Comparator",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Operators",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Comparators",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "VisitorResult",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "VisitorOperationResult",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "VisitorComparisonResult",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "VisitorStructuredQueryResult",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Visitor",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Expression",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "FilterDirective",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "Comparison",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "StructuredQuery",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "isObject",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "isFilterEmpty",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "isInt",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "isFloat",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "isString",
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: "castValue",
  },
  {
    old: "langchain/runnables/remote",
    new: "@langchain/core/runnables/remote",
    namedImport: "RemoteRunnable",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableFunc",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableLike",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableRetryFailedAttemptHandler",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "Runnable",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableBindingArgs",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableBinding",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableEach",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableRetry",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableSequence",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableMap",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableParallel",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableLambda",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableWithFallbacks",
  },
  {
    old: "langchain/schema/runnable/passthrough",
    new: "@langchain/core/runnables",
    namedImport: "RunnableAssign",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnablePick",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "_coerceToRunnable",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableBatchOptions",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableInterface",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableIOSchema",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableConfig",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "getCallbackManagerForConfig",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "patchConfig",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "ensureConfig",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "mergeConfigs",
  },
  {
    old: "langchain/schema/runnable/passthrough",
    new: "@langchain/core/runnables",
    namedImport: "RunnablePassthrough",
  },
  {
    old: "langchain/schema/runnable/router",
    new: "@langchain/core/runnables",
    namedImport: "RouterInput",
  },
  {
    old: "langchain/schema/runnable/router",
    new: "@langchain/core/runnables",
    namedImport: "RouterRunnable",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableBranch",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "Branch",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "BranchLike",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableWithMessageHistoryInputs",
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: "RunnableWithMessageHistory",
  },
  {
    old: "langchain/schema/retriever",
    new: "@langchain/core/retrievers",
    namedImport: "BaseRetrieverInput",
  },
  {
    old: "langchain/schema/retriever",
    new: "@langchain/core/retrievers",
    namedImport: "BaseRetrieverInterface",
  },
  {
    old: "langchain/schema/retriever",
    new: "@langchain/core/retrievers",
    namedImport: "BaseRetriever",
  },
  {
    old: "langchain/retrievers/document_compressors/*",
    new: "@langchain/core/retrievers/document_compressors/base",
    namedImport: "BaseDocumentCompressor",
  },
  {
    old: "langchain/prompts/base",
    new: "@langchain/core/prompts",
    namedImport: "TypedPromptInputValues",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/prompts",
    namedImport: "Example",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "BasePromptTemplateInput",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "BasePromptTemplate",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompts",
    namedImport: "BaseMessagePromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "MessagesPlaceholder",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompts",
    namedImport: "MessageStringPromptTemplateFields",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompts",
    namedImport: "BaseMessageStringPromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "BaseChatPromptTemplate",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompts",
    namedImport: "ChatMessagePromptTemplateFields",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "ChatMessagePromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "HumanMessagePromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "AIMessagePromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "SystemMessagePromptTemplate",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompts",
    namedImport: "ChatPromptTemplateInput",
  },
  {
    old: "langchain/prompts/chat",
    new: "@langchain/core/prompts",
    namedImport: "BaseMessagePromptTemplateLike",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "ChatPromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "FewShotPromptTemplateInput",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "FewShotPromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "FewShotChatMessagePromptTemplateInput",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "FewShotChatMessagePromptTemplate",
  },
  {
    old: "langchain/prompts/pipeline",
    new: "@langchain/core/prompts",
    namedImport: "PipelinePromptParams",
  },
  {
    old: "langchain/prompts/pipeline",
    new: "@langchain/core/prompts",
    namedImport: "PipelinePromptTemplateInput",
  },
  {
    old: "langchain/prompts/pipeline",
    new: "@langchain/core/prompts",
    namedImport: "PipelinePromptTemplate",
  },
  {
    old: "langchain/prompts/prompt",
    new: "@langchain/core/prompts",
    namedImport: "PromptTemplateInput",
  },
  {
    old: "langchain/prompts/prompt",
    new: "@langchain/core/prompts",
    namedImport: "ParamsFromFString",
  },
  {
    old: "langchain/prompts/prompt",
    new: "@langchain/core/prompts",
    namedImport: "PromptTemplate",
  },
  {
    old: "langchain/prompts/serde",
    new: "@langchain/core/prompts",
    namedImport: "SerializedPromptTemplate",
  },
  {
    old: "langchain/prompts/serde",
    new: "@langchain/core/prompts",
    namedImport: "SerializedFewShotTemplate",
  },
  {
    old: "langchain/prompts/serde",
    new: "@langchain/core/prompts",
    namedImport: "SerializedBasePromptTemplate",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/prompts",
    namedImport: "BaseStringPromptTemplate",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "TemplateFormat",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "parseFString",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "interpolateFString",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "DEFAULT_FORMATTER_MAPPING",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "DEFAULT_PARSER_MAPPING",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "renderTemplate",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "parseTemplate",
  },
  {
    old: "langchain/prompts/template",
    new: "@langchain/core/prompts",
    namedImport: "checkValidTemplate",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "FormatInstructionsOptions",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "BaseLLMOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "BaseOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "OutputParserException",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "BytesOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "ListOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "CommaSeparatedListOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "CustomListOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "NumberedListOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "MarkdownListOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "StringOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "JsonMarkdownStructuredOutputParserInput",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "JsonMarkdownFormatInstructionsOptions",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "StructuredOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "JsonMarkdownStructuredOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "AsymmetricStructuredOutputParserFields",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "AsymmetricStructuredOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "BaseTransformOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "BaseCumulativeTransformOutputParserInput",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "BaseCumulativeTransformOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "JsonOutputParser",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "parsePartialJson",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "parseJsonMarkdown",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "parseXMLMarkdown",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "XML_FORMAT_INSTRUCTIONS",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "XMLOutputParserFields",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "Content",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "XMLResult",
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: "XMLOutputParser",
  },
  {
    old: "langchain/output_parsers/openai_tools",
    new: "@langchain/core/output_parsers/openai_tools",
    namedImport: "ParsedToolCall",
  },
  {
    old: "langchain/output_parsers/openai_tools",
    new: "@langchain/core/output_parsers/openai_tools",
    namedImport: "JsonOutputToolsParserParams",
  },
  {
    old: "langchain/output_parsers/openai_tools",
    new: "@langchain/core/output_parsers/openai_tools",
    namedImport: "JsonOutputToolsParser",
  },
  {
    old: "langchain/output_parsers/openai_tools",
    new: "@langchain/core/output_parsers/openai_tools",
    namedImport: "JsonOutputKeyToolsParserParams",
  },
  {
    old: "langchain/output_parsers/openai_tools",
    new: "@langchain/core/output_parsers/openai_tools",
    namedImport: "JsonOutputKeyToolsParser",
  },
  {
    old: "langchain/output_parsers/openai_functions",
    new: "@langchain/core/output_parsers/openai_functions",
    namedImport: "FunctionParameters",
  },
  {
    old: "langchain/output_parsers/openai_functions",
    new: "@langchain/core/output_parsers/openai_functions",
    namedImport: "OutputFunctionsParser",
  },
  {
    old: "langchain/output_parsers/openai_functions",
    new: "@langchain/core/output_parsers/openai_functions",
    namedImport: "JsonOutputFunctionsParser",
  },
  {
    old: "langchain/output_parsers/openai_functions",
    new: "@langchain/core/output_parsers/openai_functions",
    namedImport: "JsonKeyOutputFunctionsParser",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "ToolMessageFieldsWithToolCallId",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "ToolMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "ToolMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "AIMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "AIMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "isBaseMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "isBaseMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "StoredMessageData",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "StoredMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "StoredGeneration",
  },
  {
    old: "langchain/types/assemblyai-types",
    new: "@langchain/core/messages",
    namedImport: "MessageType",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "MessageContent",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "BaseMessageFields",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "BaseMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "OpenAIToolCall",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "BaseMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "BaseMessageLike",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "ChatMessageFieldsWithRole",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "ChatMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "ChatMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "FunctionMessageFieldsWithName",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "FunctionMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "FunctionMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "HumanMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "HumanMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "SystemMessage",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "SystemMessageChunk",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "coerceMessageLikeToMessage",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/core/messages",
    namedImport: "getBufferString",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/core/messages",
    namedImport: "mapStoredMessageToChatMessage",
  },
  {
    old: "langchain/stores/message/utils",
    new: "@langchain/core/messages",
    namedImport: "mapStoredMessagesToChatMessages",
  },
  {
    old: "langchain/stores/message/utils",
    new: "@langchain/core/messages",
    namedImport: "mapChatMessagesToStoredMessages",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "get_lc_unique_name",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "BaseSerialized",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "SerializedConstructor",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "SerializedSecret",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "SerializedNotImplemented",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "Serialized",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "SerializableInterface",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: "Serializable",
  },
  {
    old: "langchain/load/map_keys",
    new: "@langchain/core/load/map_keys",
    namedImport: "SerializedFields",
  },
  {
    old: "langchain/load/*",
    new: "@langchain/core/load",
    namedImport: "load",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/core/load/import_map",
    namedImport: "agents",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/core/load/import_map",
    namedImport: "output_parsers",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/llms",
    namedImport: "SerializedLLM",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/llms",
    namedImport: "BaseLLMParams",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/llms",
    namedImport: "BaseLLMCallOptions",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/llms",
    namedImport: "BaseLLM",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/llms",
    namedImport: "LLM",
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "createChatMessageChunkEncoderStream",
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "SerializedChatModel",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "SerializedLLM",
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "BaseChatModelParams",
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "BaseChatModelCallOptions",
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "BaseChatModel",
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: "SimpleChatModel",
  },
  {
    old: "langchain/base_language/count_tokens",
    new: "@langchain/core/language_models/base",
    namedImport: "getEmbeddingContextSize",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "getModelContextSize",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "calculateMaxTokens",
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/base",
    namedImport: "SerializedLLM",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLangChainParams",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLangChain",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLanguageModelParams",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLanguageModelCallOptions",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseFunctionCallOptions",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLanguageModelInput",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLanguageModelInterface",
  },
  {
    old: "langchain/base_language/*",
    new: "@langchain/core/language_models/base",
    namedImport: "BaseLanguageModel",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "BaseExampleSelector",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "isLLM",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "isChatModel",
  },
  {
    old: "langchain/prompts/selectors/conditional",
    new: "@langchain/core/example_selectors",
    namedImport: "BaseGetPromptAsyncOptions",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "BasePromptSelector",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "ConditionalPromptSelector",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "LengthBasedExampleSelectorInput",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "LengthBasedExampleSelector",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "SemanticSimilarityExampleSelectorInput",
  },
  {
    old: "langchain/prompts/*",
    new: "@langchain/core/example_selectors",
    namedImport: "SemanticSimilarityExampleSelector",
  },
  {
    old: "langchain/document",
    new: "@langchain/core/documents",
    namedImport: "DocumentInput",
  },
  {
    old: "langchain/document",
    new: "@langchain/core/documents",
    namedImport: "Document",
  },
  {
    old: "langchain/schema/document",
    new: "@langchain/core/documents",
    namedImport: "BaseDocumentTransformer",
  },
  {
    old: "langchain/schema/document",
    new: "@langchain/core/documents",
    namedImport: "MappingDocumentTransformer",
  },
  {
    old: "langchain/callbacks/promises",
    new: "@langchain/core/callbacks/promises",
    namedImport: "consumeCallback",
  },
  {
    old: "langchain/callbacks/promises",
    new: "@langchain/core/callbacks/promises",
    namedImport: "awaitAllCallbacks",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "parseCallbackConfigArg",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "ensureHandler",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "traceAsGroup",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "CallbackManagerOptions",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "Callbacks",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "BaseCallbackConfig",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "BaseCallbackManager",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "CallbackManagerForRetrieverRun",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "CallbackManagerForLLMRun",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "CallbackManagerForChainRun",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "CallbackManagerForToolRun",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "CallbackManager",
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: "TraceGroup",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/callbacks/base",
    namedImport: "BaseCallbackHandlerInput",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/callbacks/base",
    namedImport: "NewTokenIndices",
  },
  {
    old: "langchain/callbacks/base",
    new: "@langchain/core/callbacks/base",
    namedImport: "HandleLLMNewTokenCallbackFields",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/callbacks/base",
    namedImport: "CallbackHandlerMethods",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/core/callbacks/base",
    namedImport: "BaseCallbackHandler",
  },
  {
    old: "langchain/chat_models/yandex",
    new: "@langchain/yandex",
    namedImport: "ChatYandexGPT",
  },
  {
    old: "langchain/llms/yandex",
    new: "@langchain/yandex",
    namedImport: "YandexGPTInputs",
  },
  {
    old: "langchain/llms/yandex",
    new: "@langchain/yandex",
    namedImport: "YandexGPT",
  },
  {
    old: "langchain/vectorstores/weaviate",
    new: "@langchain/weaviate",
    namedImport: "flattenObjectForWeaviate",
  },
  {
    old: "langchain/vectorstores/weaviate",
    new: "@langchain/weaviate",
    namedImport: "WeaviateLibArgs",
  },
  {
    old: "langchain/vectorstores/weaviate",
    new: "@langchain/weaviate",
    namedImport: "WeaviateFilter",
  },
  {
    old: "langchain/vectorstores/weaviate",
    new: "@langchain/weaviate",
    namedImport: "WeaviateStore",
  },
  {
    old: "langchain/stores/message/redis",
    new: "@langchain/redis",
    namedImport: "RedisChatMessageHistoryInput",
  },
  {
    old: "langchain/stores/message/redis",
    new: "@langchain/redis",
    namedImport: "RedisChatMessageHistory",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "CreateSchemaVectorField",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "CreateSchemaFlatVectorField",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "CreateSchemaHNSWVectorField",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "RedisSearchLanguages",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "RedisVectorStoreIndexOptions",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "RedisVectorStoreConfig",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "RedisAddOptions",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "RedisVectorStoreFilterType",
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/redis",
    namedImport: "RedisVectorStore",
  },
  {
    old: "langchain/vectorstores/pinecone",
    new: "@langchain/pinecone",
    namedImport: "PineconeDeleteParams",
  },
  {
    old: "langchain/vectorstores/pinecone",
    new: "@langchain/pinecone",
    namedImport: "PineconeStore",
  },
  {
    old: "langchain/llms/openai",
    new: "@langchain/openai",
    namedImport: "AzureOpenAIInput",
  },
  {
    old: "langchain/llms/openai",
    new: "@langchain/openai",
    namedImport: "OpenAICallOptions",
  },
  {
    old: "langchain/chat_models/openai",
    new: "@langchain/openai",
    namedImport: "OpenAIChatInput",
  },
  {
    old: "langchain/chat_models/openai",
    new: "@langchain/openai",
    namedImport: "ChatOpenAICallOptions",
  },
  {
    old: "langchain/chat_models/openai",
    new: "@langchain/openai",
    namedImport: "ChatOpenAI",
  },
  {
    old: "langchain/llms/openai",
    new: "@langchain/openai",
    namedImport: "OpenAIInput",
  },
  {
    old: "langchain/llms/openai-chat",
    new: "@langchain/openai",
    namedImport: "OpenAIChatCallOptions",
  },
  {
    old: "langchain/llms/openai",
    new: "@langchain/openai",
    namedImport: "OpenAIChat",
  },
  {
    old: "langchain/llms/openai",
    new: "@langchain/openai",
    namedImport: "OpenAI",
  },
  {
    old: "langchain/embeddings/openai",
    new: "@langchain/openai",
    namedImport: "OpenAIEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/openai",
    new: "@langchain/openai",
    namedImport: "OpenAIEmbeddings",
  },
  {
    old: "langchain/tools/convert_to_openai",
    new: "@langchain/openai",
    namedImport: "formatToOpenAIAssistantTool",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/openai",
    namedImport: "formatToOpenAIFunction",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/openai",
    namedImport: "formatToOpenAITool",
  },
  {
    old: "langchain/util/azure",
    new: "@langchain/openai",
    namedImport: "getEndpoint",
  },
  {
    old: "langchain/util/azure",
    new: "@langchain/openai",
    namedImport: "OpenAIEndpointConfig",
  },
  {
    old: "langchain/stores/message/mongodb",
    new: "@langchain/mongodb",
    namedImport: "MongoDBChatMessageHistoryInput",
  },
  {
    old: "langchain/stores/message/mongodb",
    new: "@langchain/mongodb",
    namedImport: "MongoDBChatMessageHistory",
  },
  {
    old: "langchain/vectorstores/mongodb_atlas",
    new: "@langchain/mongodb",
    namedImport: "MongoDBAtlasVectorSearchLibArgs",
  },
  {
    old: "langchain/vectorstores/mongodb_atlas",
    new: "@langchain/mongodb",
    namedImport: "MongoDBAtlasVectorSearch",
  },
  {
    old: "langchain/types/assemblyai-types",
    new: "@langchain/mongodb/node_modules/mongodb",
    namedImport: "Timestamp",
  },
  {
    old: "langchain/vectorstores/singlestore",
    new: "@langchain/mongodb/node_modules/mongodb",
    namedImport: "ConnectionOptions",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/mongodb/node_modules/mongodb",
    namedImport: "Filter",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/mongodb/node_modules/mongodb/client-side-encryption/providers/utils",
    namedImport: "get",
  },
  {
    old: "langchain/chat_models/googlepalm",
    new: "@langchain/google/genai",
    namedImport: "BaseMessageExamplePair",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common",
    namedImport: "GoogleAbstractedClientOpsMethod",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common",
    namedImport: "GoogleAbstractedClientOpsResponseType",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common",
    namedImport: "GoogleAbstractedClientOps",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common",
    namedImport: "GoogleAbstractedClient",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/google/common",
    namedImport: "GoogleConnection",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common",
    namedImport: "GoogleConnectionParams",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common",
    namedImport: "GoogleResponse",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/google/common",
    namedImport: "complexValue",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/google/common",
    namedImport: "simpleValue",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common/utils",
    namedImport: "GoogleVertexAIBasePrediction",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/google/common/utils",
    namedImport: "GoogleVertexAILLMPredictions",
  },
  {
    old: "langchain/vectorstores/zep",
    new: "@langchain/community/vectorstores/zep",
    namedImport: "IZepArgs",
  },
  {
    old: "langchain/vectorstores/zep",
    new: "@langchain/community/vectorstores/zep",
    namedImport: "IZepConfig",
  },
  {
    old: "langchain/vectorstores/zep",
    new: "@langchain/community/vectorstores/zep",
    namedImport: "IZepDeleteParams",
  },
  {
    old: "langchain/vectorstores/zep",
    new: "@langchain/community/vectorstores/zep",
    namedImport: "ZepVectorStore",
  },
  {
    old: "langchain/vectorstores/xata",
    new: "@langchain/community/vectorstores/xata",
    namedImport: "XataClientArgs",
  },
  {
    old: "langchain/vectorstores/xata",
    new: "@langchain/community/vectorstores/xata",
    namedImport: "XataVectorSearch",
  },
  {
    old: "langchain/vectorstores/voy",
    new: "@langchain/community/vectorstores/voy",
    namedImport: "VoyClient",
  },
  {
    old: "langchain/vectorstores/voy",
    new: "@langchain/community/vectorstores/voy",
    namedImport: "VoyVectorStore",
  },
  {
    old: "langchain/vectorstores/vercel_postgres",
    new: "@langchain/community/vectorstores/vercel_postgres",
    namedImport: "VercelPostgresFields",
  },
  {
    old: "langchain/vectorstores/vercel_postgres",
    new: "@langchain/community/vectorstores/vercel_postgres",
    namedImport: "VercelPostgres",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraLibArgs",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraFile",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraContextConfig",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "MMRConfig",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraSummary",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraFilter",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "DEFAULT_FILTER",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraRetrieverInput",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: "VectaraStore",
  },
  {
    old: "langchain/vectorstores/usearch",
    new: "@langchain/community/vectorstores/usearch",
    namedImport: "USearchArgs",
  },
  {
    old: "langchain/vectorstores/usearch",
    new: "@langchain/community/vectorstores/usearch",
    namedImport: "USearch",
  },
  {
    old: "langchain/vectorstores/typesense",
    new: "@langchain/community/vectorstores/typesense",
    namedImport: "TypesenseConfig",
  },
  {
    old: "langchain/vectorstores/typesense",
    new: "@langchain/community/vectorstores/typesense",
    namedImport: "Typesense",
  },
  {
    old: "langchain/vectorstores/typeorm",
    new: "@langchain/community/vectorstores/typeorm",
    namedImport: "TypeORMVectorStoreArgs",
  },
  {
    old: "langchain/vectorstores/typeorm",
    new: "@langchain/community/vectorstores/typeorm",
    namedImport: "TypeORMVectorStoreDocument",
  },
  {
    old: "langchain/vectorstores/typeorm",
    new: "@langchain/community/vectorstores/typeorm",
    namedImport: "TypeORMVectorStore",
  },
  {
    old: "langchain/vectorstores/tigris",
    new: "@langchain/community/vectorstores/tigris",
    namedImport: "TigrisLibArgs",
  },
  {
    old: "langchain/vectorstores/tigris",
    new: "@langchain/community/vectorstores/tigris",
    namedImport: "TigrisVectorStore",
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/vectorstores/supabase",
    namedImport: "SupabaseMetadata",
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/vectorstores/supabase",
    namedImport: "SupabaseFilter",
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/vectorstores/supabase",
    namedImport: "SupabaseFilterRPCCall",
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/vectorstores/supabase",
    namedImport: "SupabaseLibArgs",
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/vectorstores/supabase",
    namedImport: "SupabaseVectorStore",
  },
  {
    old: "langchain/vectorstores/singlestore",
    new: "@langchain/community/vectorstores/singlestore",
    namedImport: "DistanceMetrics",
  },
  {
    old: "langchain/vectorstores/singlestore",
    new: "@langchain/community/vectorstores/singlestore",
    namedImport: "SingleStoreVectorStoreConfig",
  },
  {
    old: "langchain/vectorstores/singlestore",
    new: "@langchain/community/vectorstores/singlestore",
    namedImport: "SingleStoreVectorStore",
  },
  {
    old: "langchain/vectorstores/rockset",
    new: "@langchain/community/vectorstores/rockset",
    namedImport: "RocksetStoreError",
  },
  {
    old: "langchain/vectorstores/rockset",
    new: "@langchain/community/vectorstores/rockset",
    namedImport: "RocksetStoreDestroyedError",
  },
  {
    old: "langchain/vectorstores/rockset",
    new: "@langchain/community/vectorstores/rockset",
    namedImport: "SimilarityMetric",
  },
  {
    old: "langchain/vectorstores/rockset",
    new: "@langchain/community/vectorstores/rockset",
    namedImport: "RocksetLibArgs",
  },
  {
    old: "langchain/vectorstores/rockset",
    new: "@langchain/community/vectorstores/rockset",
    namedImport: "RocksetStore",
  },
  {
    old: "langchain/vectorstores/qdrant",
    new: "@langchain/community/vectorstores/qdrant",
    namedImport: "QdrantLibArgs",
  },
  {
    old: "langchain/vectorstores/qdrant",
    new: "@langchain/community/vectorstores/qdrant",
    namedImport: "QdrantAddDocumentOptions",
  },
  {
    old: "langchain/vectorstores/qdrant",
    new: "@langchain/community/vectorstores/qdrant",
    namedImport: "QdrantVectorStore",
  },
  {
    old: "langchain/vectorstores/prisma",
    new: "@langchain/community/vectorstores/prisma",
    namedImport: "PrismaSqlFilter",
  },
  {
    old: "langchain/vectorstores/prisma",
    new: "@langchain/community/vectorstores/prisma",
    namedImport: "PrismaVectorStore",
  },
  {
    old: "langchain/vectorstores/pinecone",
    new: "@langchain/community/vectorstores/pinecone",
    namedImport: "PineconeLibArgs",
  },
  {
    old: "langchain/vectorstores/pgvector",
    new: "@langchain/community/vectorstores/pgvector",
    namedImport: "DistanceStrategy",
  },
  {
    old: "langchain/vectorstores/pgvector",
    new: "@langchain/community/vectorstores/pgvector",
    namedImport: "PGVectorStoreArgs",
  },
  {
    old: "langchain/vectorstores/pgvector",
    new: "@langchain/community/vectorstores/pgvector",
    namedImport: "PGVectorStore",
  },
  {
    old: "langchain/vectorstores/opensearch",
    new: "@langchain/community/vectorstores/opensearch",
    namedImport: "OpenSearchClientArgs",
  },
  {
    old: "langchain/vectorstores/opensearch",
    new: "@langchain/community/vectorstores/opensearch",
    namedImport: "OpenSearchVectorStore",
  },
  {
    old: "langchain/vectorstores/neo4j_vector",
    new: "@langchain/community/vectorstores/neo4j_vector",
    namedImport: "SearchType",
  },
  {
    old: "langchain/vectorstores/pgvector",
    new: "@langchain/community/vectorstores/neo4j_vector",
    namedImport: "DistanceStrategy",
  },
  {
    old: "langchain/vectorstores/neo4j_vector",
    new: "@langchain/community/vectorstores/neo4j_vector",
    namedImport: "Neo4jVectorStore",
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/myscale",
    namedImport: "MyScaleLibArgs",
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/myscale",
    namedImport: "ColumnMap",
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/myscale",
    namedImport: "metric",
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/myscale",
    namedImport: "MyScaleFilter",
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/myscale",
    namedImport: "MyScaleStore",
  },
  {
    old: "langchain/vectorstores/momento_vector_index",
    new: "@langchain/community/vectorstores/momento_vector_index",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/milvus",
    new: "@langchain/community/vectorstores/milvus",
    namedImport: "MilvusLibArgs",
  },
  {
    old: "langchain/vectorstores/milvus",
    new: "@langchain/community/vectorstores/milvus",
    namedImport: "Milvus",
  },
  {
    old: "langchain/vectorstores/lancedb",
    new: "@langchain/community/vectorstores/lancedb",
    namedImport: "LanceDBArgs",
  },
  {
    old: "langchain/vectorstores/lancedb",
    new: "@langchain/community/vectorstores/lancedb",
    namedImport: "LanceDB",
  },
  {
    old: "langchain/vectorstores/hnswlib",
    new: "@langchain/community/vectorstores/hnswlib",
    namedImport: "HNSWLibBase",
  },
  {
    old: "langchain/vectorstores/hnswlib",
    new: "@langchain/community/vectorstores/hnswlib",
    namedImport: "HNSWLibArgs",
  },
  {
    old: "langchain/vectorstores/hnswlib",
    new: "@langchain/community/vectorstores/hnswlib",
    namedImport: "HNSWLib",
  },
  {
    old: "langchain/vectorstores/pgvector",
    new: "@langchain/community/vectorstores/hanavector",
    namedImport: "DistanceStrategy",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "IdDocumentInput",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "IdDocument",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "MatchingEngineDeleteParams",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "Restriction",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "PublicAPIEndpointInfo",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "MatchingEngineArgs",
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: "MatchingEngine",
  },
  {
    old: "langchain/vectorstores/faiss",
    new: "@langchain/community/vectorstores/faiss",
    namedImport: "FaissLibArgs",
  },
  {
    old: "langchain/vectorstores/faiss",
    new: "@langchain/community/vectorstores/faiss",
    namedImport: "FaissStore",
  },
  {
    old: "langchain/vectorstores/elasticsearch",
    new: "@langchain/community/vectorstores/elasticsearch",
    namedImport: "ElasticClientArgs",
  },
  {
    old: "langchain/vectorstores/elasticsearch",
    new: "@langchain/community/vectorstores/elasticsearch",
    namedImport: "ElasticVectorSearch",
  },
  {
    old: "langchain/vectorstores/convex",
    new: "@langchain/community/vectorstores/convex",
    namedImport: "ConvexVectorStoreConfig",
  },
  {
    old: "langchain/vectorstores/convex",
    new: "@langchain/community/vectorstores/convex",
    namedImport: "ConvexVectorStore",
  },
  {
    old: "langchain/vectorstores/clickhouse",
    new: "@langchain/community/vectorstores/clickhouse",
    namedImport: "ClickHouseLibArgs",
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/clickhouse",
    namedImport: "ColumnMap",
  },
  {
    old: "langchain/vectorstores/clickhouse",
    new: "@langchain/community/vectorstores/clickhouse",
    namedImport: "ClickHouseFilter",
  },
  {
    old: "langchain/vectorstores/clickhouse",
    new: "@langchain/community/vectorstores/clickhouse",
    namedImport: "ClickHouseStore",
  },
  {
    old: "langchain/vectorstores/chroma",
    new: "@langchain/community/vectorstores/chroma",
    namedImport: "ChromaLibArgs",
  },
  {
    old: "langchain/vectorstores/chroma",
    new: "@langchain/community/vectorstores/chroma",
    namedImport: "ChromaDeleteParams",
  },
  {
    old: "langchain/vectorstores/chroma",
    new: "@langchain/community/vectorstores/chroma",
    namedImport: "Chroma",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: "Column",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: "Index",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: "WhereClause",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: "SupportedVectorTypes",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: "CassandraLibArgs",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: "CassandraStore",
  },
  {
    old: "langchain/vectorstores/analyticdb",
    new: "@langchain/community/vectorstores/analyticdb",
    namedImport: "AnalyticDBArgs",
  },
  {
    old: "langchain/vectorstores/analyticdb",
    new: "@langchain/community/vectorstores/analyticdb",
    namedImport: "AnalyticDBVectorStore",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/vectorstores/tests/convex/convex/langchain/db",
    namedImport: "get",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/vectorstores/tests/convex/convex/langchain/db",
    namedImport: "insert",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/vectorstores/tests/convex/convex/langchain/db",
    namedImport: "lookup",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/vectorstores/tests/convex/convex/langchain/db",
    namedImport: "upsert",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/vectorstores/tests/convex/convex/langchain/db",
    namedImport: "deleteMany",
  },
  {
    old: "langchain/vectorstores/closevector/web",
    new: "@langchain/community/vectorstores/closevector/web",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/closevector/node",
    new: "@langchain/community/vectorstores/closevector/node",
    namedImport: "CloseVectorNodeArgs",
  },
  {
    old: "langchain/vectorstores/closevector/node",
    new: "@langchain/community/vectorstores/closevector/node",
    namedImport: "CloseVectorNode",
  },
  {
    old: "langchain/llms/ollama",
    new: "@langchain/community/utils/ollama",
    namedImport: "OllamaInput",
  },
  {
    old: "langchain/llms/ollama",
    new: "@langchain/community/utils/ollama",
    namedImport: "OllamaCallOptions",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/community/utils/googlevertexai-connection",
    namedImport: "GoogleVertexAIConnection",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/community/utils/googlevertexai-connection",
    namedImport: "GoogleVertexAILLMConnection",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/community/utils/googlevertexai-connection",
    namedImport: "GoogleVertexAILLMResponse",
  },
  {
    old: "langchain/util/googlevertexai-connection",
    new: "@langchain/community/utils/googlevertexai-connection",
    namedImport: "GoogleVertexAIStream",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: "getBytes",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: "getLines",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: "getMessages",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: "convertEventStreamToIterableReadableDataStream",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: "EventStreamContentType",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: "EventSourceMessage",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/utils/convex",
    namedImport: "get",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/utils/convex",
    namedImport: "insert",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/utils/convex",
    namedImport: "lookup",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/utils/convex",
    namedImport: "upsert",
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/utils/convex",
    namedImport: "deleteMany",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/utils/cassandra",
    namedImport: "Column",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/utils/cassandra",
    namedImport: "Index",
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/utils/cassandra",
    namedImport: "WhereClause",
  },
  {
    old: "langchain/types/type-utils",
    new: "@langchain/community/types/type-utils",
    namedImport: "Optional",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/community/types/googlevertexai-types",
    namedImport: "GoogleVertexAIConnectionParams",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/community/types/googlevertexai-types",
    namedImport: "GoogleVertexAIModelParams",
  },
  {
    old: "langchain/types/googlevertexai-types",
    new: "@langchain/community/types/googlevertexai-types",
    namedImport: "GoogleVertexAIBaseLLMInput",
  },
  {
    old: "langchain/tools/wolframalpha",
    new: "@langchain/community/tools/wolframalpha",
    namedImport: "WolframAlphaTool",
  },
  {
    old: "langchain/tools/wikipedia_query_run",
    new: "@langchain/community/tools/wikipedia_query_run",
    namedImport: "WikipediaQueryRunParams",
  },
  {
    old: "langchain/tools/wikipedia_query_run",
    new: "@langchain/community/tools/wikipedia_query_run",
    namedImport: "WikipediaQueryRun",
  },
  {
    old: "langchain/retrievers/tavily_search_api",
    new: "@langchain/community/tools/tavily_search",
    namedImport: "TavilySearchAPIRetrieverFields",
  },
  {
    old: "langchain/tools/serper",
    new: "@langchain/community/tools/serper",
    namedImport: "SerperParameters",
  },
  {
    old: "langchain/tools/serper",
    new: "@langchain/community/tools/serper",
    namedImport: "Serper",
  },
  {
    old: "langchain/tools/serpapi",
    new: "@langchain/community/tools/serpapi",
    namedImport: "SerpAPIParameters",
  },
  {
    old: "langchain/tools/serpapi",
    new: "@langchain/community/tools/serpapi",
    namedImport: "SerpAPI",
  },
  {
    old: "langchain/tools/searxng_search",
    new: "@langchain/community/tools/searxng_search",
    namedImport: "SearxngSearch",
  },
  {
    old: "langchain/tools/searchapi",
    new: "@langchain/community/tools/searchapi",
    namedImport: "SearchApiParameters",
  },
  {
    old: "langchain/tools/searchapi",
    new: "@langchain/community/tools/searchapi",
    namedImport: "SearchApi",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/ifttt",
    namedImport: "IFTTTWebhook",
  },
  {
    old: "langchain/tools/google_places",
    new: "@langchain/community/tools/google_places",
    namedImport: "GooglePlacesAPIParams",
  },
  {
    old: "langchain/tools/google_places",
    new: "@langchain/community/tools/google_places",
    namedImport: "GooglePlacesAPI",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/google_custom_search",
    namedImport: "GoogleCustomSearchParams",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/google_custom_search",
    namedImport: "GoogleCustomSearch",
  },
  {
    old: "langchain/tools/dynamic",
    new: "@langchain/community/tools/dynamic",
    namedImport: "BaseDynamicToolInput",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dynamic",
    namedImport: "DynamicToolInput",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dynamic",
    namedImport: "DynamicStructuredToolInput",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dynamic",
    namedImport: "DynamicTool",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dynamic",
    namedImport: "DynamicStructuredTool",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dataforseo_api_search",
    namedImport: "DataForSeoApiConfig",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dataforseo_api_search",
    namedImport: "DataForSeoAPISearch",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/dadjokeapi",
    namedImport: "DadJokeAPI",
  },
  {
    old: "langchain/tools/connery",
    new: "@langchain/community/tools/connery",
    namedImport: "ConneryServiceParams",
  },
  {
    old: "langchain/tools/connery",
    new: "@langchain/community/tools/connery",
    namedImport: "ConneryAction",
  },
  {
    old: "langchain/tools/connery",
    new: "@langchain/community/tools/connery",
    namedImport: "ConneryService",
  },
  {
    old: "langchain/tools/calculator",
    new: "@langchain/community/tools/calculator",
    namedImport: "Calculator",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/brave_search",
    namedImport: "BraveSearchParams",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/brave_search",
    namedImport: "BraveSearch",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/bingserpapi",
    namedImport: "BingSerpAPI",
  },
  {
    old: "langchain/tools/aws_sfn",
    new: "@langchain/community/tools/aws_sfn",
    namedImport: "SfnConfig",
  },
  {
    old: "langchain/tools/aws_sfn",
    new: "@langchain/community/tools/aws_sfn",
    namedImport: "StartExecutionAWSSfnTool",
  },
  {
    old: "langchain/tools/aws_sfn",
    new: "@langchain/community/tools/aws_sfn",
    namedImport: "DescribeExecutionAWSSfnTool",
  },
  {
    old: "langchain/tools/aws_sfn",
    new: "@langchain/community/tools/aws_sfn",
    namedImport: "SendTaskSuccessAWSSfnTool",
  },
  {
    old: "langchain/tools/aws_lambda",
    new: "@langchain/community/tools/aws_lambda",
    namedImport: "AWSLambda",
  },
  {
    old: "langchain/tools/aiplugin",
    new: "@langchain/community/tools/aiplugin",
    namedImport: "AIPluginToolParams",
  },
  {
    old: "langchain/tools/*",
    new: "@langchain/community/tools/aiplugin",
    namedImport: "AIPluginTool",
  },
  {
    old: "langchain/tools/google_calendar/*",
    new: "@langchain/community/tools/google_calendar",
    namedImport: "GoogleCalendarCreateTool",
  },
  {
    old: "langchain/tools/google_calendar/*",
    new: "@langchain/community/tools/google_calendar",
    namedImport: "GoogleCalendarViewTool",
  },
  {
    old: "langchain/tools/google_calendar/*",
    new: "@langchain/community/tools/google_calendar",
    namedImport: "GoogleCalendarAgentParams",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GmailCreateDraft",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GmailGetMessage",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GmailGetThread",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GmailSearch",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GmailSendMessage",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GmailBaseToolParams",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "CreateDraftSchema",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GetMessageSchema",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "GetThreadSchema",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "SearchSchema",
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: "SendMessageSchema",
  },
  {
    old: "langchain/stores/message/xata",
    new: "@langchain/community/stores/message/xata",
    namedImport: "XataChatMessageHistoryInput",
  },
  {
    old: "langchain/stores/message/xata",
    new: "@langchain/community/stores/message/xata",
    namedImport: "XataChatMessageHistory",
  },
  {
    old: "langchain/stores/message/upstash_redis",
    new: "@langchain/community/stores/message/upstash_redis",
    namedImport: "UpstashRedisChatMessageHistoryInput",
  },
  {
    old: "langchain/stores/message/upstash_redis",
    new: "@langchain/community/stores/message/upstash_redis",
    namedImport: "UpstashRedisChatMessageHistory",
  },
  {
    old: "langchain/stores/message/planetscale",
    new: "@langchain/community/stores/message/planetscale",
    namedImport: "PlanetScaleChatMessageHistoryInput",
  },
  {
    old: "langchain/stores/message/planetscale",
    new: "@langchain/community/stores/message/planetscale",
    namedImport: "PlanetScaleChatMessageHistory",
  },
  {
    old: "langchain/stores/message/momento",
    new: "@langchain/community/stores/message/momento",
    namedImport: "MomentoChatMessageHistoryProps",
  },
  {
    old: "langchain/stores/message/momento",
    new: "@langchain/community/stores/message/momento",
    namedImport: "MomentoChatMessageHistory",
  },
  {
    old: "langchain/stores/message/in_memory",
    new: "@langchain/community/stores/message/in_memory",
    namedImport: "ChatMessageHistory",
  },
  {
    old: "langchain/stores/message/firestore",
    new: "@langchain/community/stores/message/firestore",
    namedImport: "FirestoreDBChatMessageHistory",
  },
  {
    old: "langchain/stores/message/firestore",
    new: "@langchain/community/stores/message/firestore",
    namedImport: "FirestoreChatMessageHistory",
  },
  {
    old: "langchain/stores/message/dynamodb",
    new: "@langchain/community/stores/message/dynamodb",
    namedImport: "DynamoDBChatMessageHistoryFields",
  },
  {
    old: "langchain/stores/message/dynamodb",
    new: "@langchain/community/stores/message/dynamodb",
    namedImport: "DynamoDBChatMessageHistory",
  },
  {
    old: "langchain/stores/message/convex",
    new: "@langchain/community/stores/message/convex",
    namedImport: "ConvexChatMessageHistoryInput",
  },
  {
    old: "langchain/stores/message/convex",
    new: "@langchain/community/stores/message/convex",
    namedImport: "ConvexChatMessageHistory",
  },
  {
    old: "langchain/stores/message/cassandra",
    new: "@langchain/community/stores/message/cassandra",
    namedImport: "CassandraChatMessageHistoryOptions",
  },
  {
    old: "langchain/stores/message/cassandra",
    new: "@langchain/community/stores/message/cassandra",
    namedImport: "CassandraChatMessageHistory",
  },
  {
    old: "langchain/stores/doc/in_memory",
    new: "@langchain/community/stores/doc/in_memory",
    namedImport: "InMemoryDocstore",
  },
  {
    old: "langchain/stores/doc/in_memory",
    new: "@langchain/community/stores/doc/in_memory",
    namedImport: "SynchronousInMemoryDocstore",
  },
  {
    old: "langchain/schema/*",
    new: "@langchain/community/stores/doc/base",
    namedImport: "Docstore",
  },
  {
    old: "langchain/storage/vercel_kv",
    new: "@langchain/community/storage/vercel_kv",
    namedImport: "VercelKVStore",
  },
  {
    old: "langchain/storage/upstash_redis",
    new: "@langchain/community/storage/upstash_redis",
    namedImport: "UpstashRedisStoreInput",
  },
  {
    old: "langchain/storage/upstash_redis",
    new: "@langchain/community/storage/upstash_redis",
    namedImport: "UpstashRedisStore",
  },
  {
    old: "langchain/storage/ioredis",
    new: "@langchain/community/storage/ioredis",
    namedImport: "RedisByteStore",
  },
  {
    old: "langchain/storage/convex",
    new: "@langchain/community/storage/convex",
    namedImport: "ConvexKVStoreConfig",
  },
  {
    old: "langchain/storage/convex",
    new: "@langchain/community/storage/convex",
    namedImport: "ConvexKVStore",
  },
  {
    old: "langchain/retrievers/zep",
    new: "@langchain/community/retrievers/zep",
    namedImport: "ZepRetrieverConfig",
  },
  {
    old: "langchain/retrievers/zep",
    new: "@langchain/community/retrievers/zep",
    namedImport: "ZepRetriever",
  },
  {
    old: "langchain/retrievers/vespa",
    new: "@langchain/community/retrievers/vespa",
    namedImport: "VespaRetrieverParams",
  },
  {
    old: "langchain/retrievers/vespa",
    new: "@langchain/community/retrievers/vespa",
    namedImport: "VespaRetriever",
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/retrievers/vectara_summary",
    namedImport: "VectaraRetrieverInput",
  },
  {
    old: "langchain/retrievers/vectara_summary",
    new: "@langchain/community/retrievers/vectara_summary",
    namedImport: "VectaraSummaryRetriever",
  },
  {
    old: "langchain/retrievers/tavily_search_api",
    new: "@langchain/community/retrievers/tavily_search_api",
    namedImport: "TavilySearchAPIRetrieverFields",
  },
  {
    old: "langchain/retrievers/tavily_search_api",
    new: "@langchain/community/retrievers/tavily_search_api",
    namedImport: "TavilySearchAPIRetriever",
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/retrievers/supabase",
    namedImport: "SupabaseLibArgs",
  },
  {
    old: "langchain/retrievers/supabase",
    new: "@langchain/community/retrievers/supabase",
    namedImport: "SupabaseHybridSearchParams",
  },
  {
    old: "langchain/retrievers/supabase",
    new: "@langchain/community/retrievers/supabase",
    namedImport: "SupabaseHybridSearch",
  },
  {
    old: "langchain/retrievers/metal",
    new: "@langchain/community/retrievers/metal",
    namedImport: "MetalRetrieverFields",
  },
  {
    old: "langchain/retrievers/metal",
    new: "@langchain/community/retrievers/metal",
    namedImport: "MetalRetriever",
  },
  {
    old: "langchain/retrievers/databerry",
    new: "@langchain/community/retrievers/databerry",
    namedImport: "DataberryRetrieverArgs",
  },
  {
    old: "langchain/retrievers/databerry",
    new: "@langchain/community/retrievers/databerry",
    namedImport: "DataberryRetriever",
  },
  {
    old: "langchain/retrievers/chaindesk",
    new: "@langchain/community/retrievers/chaindesk",
    namedImport: "ChaindeskRetrieverArgs",
  },
  {
    old: "langchain/retrievers/chaindesk",
    new: "@langchain/community/retrievers/chaindesk",
    namedImport: "ChaindeskRetriever",
  },
  {
    old: "langchain/retrievers/amazon_kendra",
    new: "@langchain/community/retrievers/amazon_kendra",
    namedImport: "AmazonKendraRetrieverArgs",
  },
  {
    old: "langchain/retrievers/amazon_kendra",
    new: "@langchain/community/retrievers/amazon_kendra",
    namedImport: "AmazonKendraRetriever",
  },
  {
    old: "langchain/retrievers/remote/*",
    new: "@langchain/community/retrievers/remote",
    namedImport: "RemoteRetriever",
  },
  {
    old: "langchain/retrievers/remote/*",
    new: "@langchain/community/retrievers/remote",
    namedImport: "RemoteRetrieverParams",
  },
  {
    old: "langchain/retrievers/remote/*",
    new: "@langchain/community/retrievers/remote",
    namedImport: "RemoteRetrieverAuth",
  },
  {
    old: "langchain/retrievers/remote/*",
    new: "@langchain/community/retrievers/remote",
    namedImport: "RemoteRetrieverValues",
  },
  {
    old: "langchain/memory/zep",
    new: "@langchain/community/memory/zep",
    namedImport: "ZepMemoryInput",
  },
  {
    old: "langchain/memory/zep",
    new: "@langchain/community/memory/zep",
    namedImport: "ZepMemory",
  },
  {
    old: "langchain/memory/motorhead_memory",
    new: "@langchain/community/memory/motorhead_memory",
    namedImport: "MotorheadMemoryMessage",
  },
  {
    old: "langchain/memory/motorhead_memory",
    new: "@langchain/community/memory/motorhead_memory",
    namedImport: "MotorheadMemoryInput",
  },
  {
    old: "langchain/memory/motorhead_memory",
    new: "@langchain/community/memory/motorhead_memory",
    namedImport: "MotorheadMemory",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/community/memory/chat_memory",
    namedImport: "BaseChatMemoryInput",
  },
  {
    old: "langchain/memory/*",
    new: "@langchain/community/memory/chat_memory",
    namedImport: "BaseChatMemory",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "get_lc_unique_name",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "BaseSerialized",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "SerializedConstructor",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "SerializedSecret",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "SerializedNotImplemented",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "Serialized",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "SerializableInterface",
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/community/load/serializable",
    namedImport: "Serializable",
  },
  {
    old: "langchain/load/map_keys",
    new: "@langchain/community/load/map_keys",
    namedImport: "SerializedFields",
  },
  {
    old: "langchain/load/import_type",
    new: "@langchain/community/load",
    namedImport: "OptionalImportMap",
  },
  {
    old: "langchain/load/import_type",
    new: "@langchain/community/load",
    namedImport: "SecretMap",
  },
  {
    old: "langchain/load/import_constants",
    new: "@langchain/community/load",
    namedImport: "optionalImportEntrypoints",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/community/load/import_map",
    namedImport: "llms__fireworks",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/community/load/import_map",
    namedImport: "chat_models__fireworks",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/community/load/import_map",
    namedImport: "retrievers__remote",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/community/load/import_map",
    namedImport: "retrievers__vespa",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/community/load/import_map",
    namedImport: "stores__doc__in_memory",
  },
  {
    old: "langchain/load/import_map",
    new: "@langchain/community/load/import_map",
    namedImport: "stores__message__in_memory",
  },
  {
    old: "langchain/llms/writer",
    new: "@langchain/community/llms/writer",
    namedImport: "WriterInput",
  },
  {
    old: "langchain/llms/writer",
    new: "@langchain/community/llms/writer",
    namedImport: "Writer",
  },
  {
    old: "langchain/llms/watsonx_ai",
    new: "@langchain/community/llms/watsonx_ai",
    namedImport: "WatsonxAIParams",
  },
  {
    old: "langchain/llms/watsonx_ai",
    new: "@langchain/community/llms/watsonx_ai",
    namedImport: "WatsonxAI",
  },
  {
    old: "langchain/llms/sagemaker_endpoint",
    new: "@langchain/community/llms/sagemaker_endpoint",
    namedImport: "BaseSageMakerContentHandler",
  },
  {
    old: "langchain/llms/sagemaker_endpoint",
    new: "@langchain/community/llms/sagemaker_endpoint",
    namedImport: "SageMakerLLMContentHandler",
  },
  {
    old: "langchain/llms/sagemaker_endpoint",
    new: "@langchain/community/llms/sagemaker_endpoint",
    namedImport: "SageMakerEndpointInput",
  },
  {
    old: "langchain/llms/sagemaker_endpoint",
    new: "@langchain/community/llms/sagemaker_endpoint",
    namedImport: "SageMakerEndpoint",
  },
  {
    old: "langchain/llms/replicate",
    new: "@langchain/community/llms/replicate",
    namedImport: "ReplicateInput",
  },
  {
    old: "langchain/llms/replicate",
    new: "@langchain/community/llms/replicate",
    namedImport: "Replicate",
  },
  {
    old: "langchain/llms/raycast",
    new: "@langchain/community/llms/raycast",
    namedImport: "RaycastAIInput",
  },
  {
    old: "langchain/llms/raycast",
    new: "@langchain/community/llms/raycast",
    namedImport: "RaycastAI",
  },
  {
    old: "langchain/llms/portkey",
    new: "@langchain/community/llms/portkey",
    namedImport: "getPortkeySession",
  },
  {
    old: "langchain/llms/portkey",
    new: "@langchain/community/llms/portkey",
    namedImport: "PortkeySession",
  },
  {
    old: "langchain/llms/portkey",
    new: "@langchain/community/llms/portkey",
    namedImport: "Portkey",
  },
  {
    old: "langchain/llms/ollama",
    new: "@langchain/community/llms/ollama",
    namedImport: "OllamaInput",
  },
  {
    old: "langchain/llms/ollama",
    new: "@langchain/community/llms/ollama",
    namedImport: "OllamaCallOptions",
  },
  {
    old: "langchain/llms/ollama",
    new: "@langchain/community/llms/ollama",
    namedImport: "Ollama",
  },
  {
    old: "langchain/llms/llama_cpp",
    new: "@langchain/community/llms/llama_cpp",
    namedImport: "LlamaCppInputs",
  },
  {
    old: "langchain/llms/llama_cpp",
    new: "@langchain/community/llms/llama_cpp",
    namedImport: "LlamaCppCallOptions",
  },
  {
    old: "langchain/llms/llama_cpp",
    new: "@langchain/community/llms/llama_cpp",
    namedImport: "LlamaCpp",
  },
  {
    old: "langchain/llms/hf",
    new: "@langchain/community/llms/hf",
    namedImport: "HFInput",
  },
  {
    old: "langchain/llms/hf",
    new: "@langchain/community/llms/hf",
    namedImport: "HuggingFaceInference",
  },
  {
    old: "langchain/llms/gradient_ai",
    new: "@langchain/community/llms/gradient_ai",
    namedImport: "GradientLLMParams",
  },
  {
    old: "langchain/llms/gradient_ai",
    new: "@langchain/community/llms/gradient_ai",
    namedImport: "GradientLLM",
  },
  {
    old: "langchain/llms/googlepalm",
    new: "@langchain/community/llms/googlepalm",
    namedImport: "GooglePaLMTextInput",
  },
  {
    old: "langchain/llms/googlepalm",
    new: "@langchain/community/llms/googlepalm",
    namedImport: "GooglePaLM",
  },
  {
    old: "langchain/llms/fireworks",
    new: "@langchain/community/llms/fireworks",
    namedImport: "FireworksCallOptions",
  },
  {
    old: "langchain/llms/fireworks",
    new: "@langchain/community/llms/fireworks",
    namedImport: "Fireworks",
  },
  {
    old: "langchain/llms/aleph_alpha",
    new: "@langchain/community/llms/aleph_alpha",
    namedImport: "AlephAlphaInput",
  },
  {
    old: "langchain/llms/aleph_alpha",
    new: "@langchain/community/llms/aleph_alpha",
    namedImport: "AlephAlpha",
  },
  {
    old: "langchain/llms/ai21",
    new: "@langchain/community/llms/ai21",
    namedImport: "AI21PenaltyData",
  },
  {
    old: "langchain/llms/ai21",
    new: "@langchain/community/llms/ai21",
    namedImport: "AI21Input",
  },
  {
    old: "langchain/llms/ai21",
    new: "@langchain/community/llms/ai21",
    namedImport: "AI21",
  },
  {
    old: "langchain/llms/googlevertexai/web",
    new: "@langchain/community/llms/googlevertexai/web",
    namedImport: null,
  },
  {
    old: "langchain/llms/bedrock",
    new: "@langchain/community/llms/bedrock",
    namedImport: null,
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: "AddGraphDocumentsConfig",
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: "NodeType",
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: "RelType",
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: "PathType",
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: "BASE_ENTITY_LABEL",
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: "Neo4jGraph",
  },
  {
    old: "langchain/embeddings/voyage",
    new: "@langchain/community/embeddings/voyage",
    namedImport: "VoyageEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/voyage",
    new: "@langchain/community/embeddings/voyage",
    namedImport: "CreateVoyageEmbeddingRequest",
  },
  {
    old: "langchain/embeddings/voyage",
    new: "@langchain/community/embeddings/voyage",
    namedImport: "VoyageEmbeddings",
  },
  {
    old: "langchain/embeddings/tensorflow",
    new: "@langchain/community/embeddings/tensorflow",
    namedImport: "TensorFlowEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/tensorflow",
    new: "@langchain/community/embeddings/tensorflow",
    namedImport: "TensorFlowEmbeddings",
  },
  {
    old: "langchain/embeddings/ollama",
    new: "@langchain/community/embeddings/ollama",
    namedImport: "OllamaEmbeddings",
  },
  {
    old: "langchain/embeddings/minimax",
    new: "@langchain/community/embeddings/minimax",
    namedImport: "MinimaxEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/minimax",
    new: "@langchain/community/embeddings/minimax",
    namedImport: "CreateMinimaxEmbeddingRequest",
  },
  {
    old: "langchain/embeddings/minimax",
    new: "@langchain/community/embeddings/minimax",
    namedImport: "MinimaxEmbeddings",
  },
  {
    old: "langchain/embeddings/llama_cpp",
    new: "@langchain/community/embeddings/llama_cpp",
    namedImport: "LlamaCppEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/llama_cpp",
    new: "@langchain/community/embeddings/llama_cpp",
    namedImport: "LlamaCppEmbeddings",
  },
  {
    old: "langchain/embeddings/hf_transformers",
    new: "@langchain/community/embeddings/hf_transformers",
    namedImport: "HuggingFaceTransformersEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/hf_transformers",
    new: "@langchain/community/embeddings/hf_transformers",
    namedImport: "HuggingFaceTransformersEmbeddings",
  },
  {
    old: "langchain/embeddings/hf",
    new: "@langchain/community/embeddings/hf",
    namedImport: "HuggingFaceInferenceEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/hf",
    new: "@langchain/community/embeddings/hf",
    namedImport: "HuggingFaceInferenceEmbeddings",
  },
  {
    old: "langchain/embeddings/gradient_ai",
    new: "@langchain/community/embeddings/gradient_ai",
    namedImport: "GradientEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/gradient_ai",
    new: "@langchain/community/embeddings/gradient_ai",
    namedImport: "GradientEmbeddings",
  },
  {
    old: "langchain/embeddings/googlevertexai",
    new: "@langchain/community/embeddings/googlevertexai",
    namedImport: "GoogleVertexAIEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/googlevertexai",
    new: "@langchain/community/embeddings/googlevertexai",
    namedImport: "GoogleVertexAIEmbeddings",
  },
  {
    old: "langchain/embeddings/googlepalm",
    new: "@langchain/community/embeddings/googlepalm",
    namedImport: "GooglePaLMEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/googlepalm",
    new: "@langchain/community/embeddings/googlepalm",
    namedImport: "GooglePaLMEmbeddings",
  },
  {
    old: "langchain/embeddings/bedrock",
    new: "@langchain/community/embeddings/bedrock",
    namedImport: "BedrockEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/bedrock",
    new: "@langchain/community/embeddings/bedrock",
    namedImport: "BedrockEmbeddings",
  },
  {
    old: "langchain/document_transformers/mozilla_readability",
    new: "@langchain/community/document_transformers/mozilla_readability",
    namedImport: "MozillaReadabilityTransformer",
  },
  {
    old: "langchain/document_transformers/html_to_text",
    new: "@langchain/community/document_transformers/html_to_text",
    namedImport: "HtmlToTextTransformer",
  },
  {
    old: "langchain/chat_models/portkey",
    new: "@langchain/community/chat_models/portkey",
    namedImport: "PortkeyChat",
  },
  {
    old: "langchain/chat_models/ollama",
    new: "@langchain/community/chat_models/ollama",
    namedImport: "ChatOllamaInput",
  },
  {
    old: "langchain/chat_models/ollama",
    new: "@langchain/community/chat_models/ollama",
    namedImport: "ChatOllamaCallOptions",
  },
  {
    old: "langchain/chat_models/ollama",
    new: "@langchain/community/chat_models/ollama",
    namedImport: "ChatOllama",
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/chat_models/minimax",
    namedImport: "MinimaxMessageRole",
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/chat_models/minimax",
    namedImport: "ChatMinimaxCallOptions",
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/chat_models/minimax",
    namedImport: "ChatMinimax",
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/chat_models/minimax",
    namedImport: "ChatCompletionResponseMessageFunctionCall",
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/chat_models/minimax",
    namedImport: "ChatCompletionResponseChoicesPro",
  },
  {
    old: "langchain/llms/llama_cpp",
    new: "@langchain/community/chat_models/llama_cpp",
    namedImport: "LlamaCppInputs",
  },
  {
    old: "langchain/llms/llama_cpp",
    new: "@langchain/community/chat_models/llama_cpp",
    namedImport: "LlamaCppCallOptions",
  },
  {
    old: "langchain/chat_models/llama_cpp",
    new: "@langchain/community/chat_models/llama_cpp",
    namedImport: "ChatLlamaCpp",
  },
  {
    old: "langchain/chat_models/googlepalm",
    new: "@langchain/community/chat_models/googlepalm",
    namedImport: "GooglePaLMChatInput",
  },
  {
    old: "langchain/chat_models/googlepalm",
    new: "@langchain/community/chat_models/googlepalm",
    namedImport: "ChatGooglePaLM",
  },
  {
    old: "langchain/chat_models/fireworks",
    new: "@langchain/community/chat_models/fireworks",
    namedImport: "ChatFireworksCallOptions",
  },
  {
    old: "langchain/chat_models/fireworks",
    new: "@langchain/community/chat_models/fireworks",
    namedImport: "ChatFireworks",
  },
  {
    old: "langchain/chat_models/baiduwenxin",
    new: "@langchain/community/chat_models/baiduwenxin",
    namedImport: "WenxinMessageRole",
  },
  {
    old: "langchain/chat_models/baiduwenxin",
    new: "@langchain/community/chat_models/baiduwenxin",
    namedImport: "ChatBaiduWenxin",
  },
  {
    old: "langchain/chat_models/iflytek_xinghuo/web",
    new: "@langchain/community/chat_models/iflytek_xinghuo/web",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/googlevertexai/web",
    new: "@langchain/community/chat_models/googlevertexai/web",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/bedrock/web",
    new: "@langchain/community/chat_models/bedrock/web",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/llmonitor",
    new: "@langchain/community/callbacks/handlers/llmonitor",
    namedImport: "convertToLLMonitorMessages",
  },
  {
    old: "langchain/callbacks/*",
    new: "@langchain/community/callbacks/handlers/llmonitor",
    namedImport: "Run",
  },
  {
    old: "langchain/callbacks/handlers/tracer_langchain",
    new: "@langchain/community/callbacks/handlers/llmonitor",
    namedImport: "RunUpdate",
  },
  {
    old: "langchain/callbacks/handlers/llmonitor",
    new: "@langchain/community/callbacks/handlers/llmonitor",
    namedImport: "LLMonitorHandlerFields",
  },
  {
    old: "langchain/callbacks/handlers/llmonitor",
    new: "@langchain/community/callbacks/handlers/llmonitor",
    namedImport: "LLMonitorHandler",
  },
  {
    old: "langchain/cache/upstash_redis",
    new: "@langchain/community/caches/upstash_redis",
    namedImport: "UpstashRedisCacheProps",
  },
  {
    old: "langchain/cache/upstash_redis",
    new: "@langchain/community/caches/upstash_redis",
    namedImport: "UpstashRedisCache",
  },
  {
    old: "langchain/cache/momento",
    new: "@langchain/community/caches/momento",
    namedImport: "MomentoCacheProps",
  },
  {
    old: "langchain/cache/momento",
    new: "@langchain/community/caches/momento",
    namedImport: "MomentoCache",
  },
  {
    old: "langchain/agents/*",
    new: "@langchain/community/agents/toolkits/base",
    namedImport: "Toolkit",
  },
  {
    old: "langchain/agents/toolkits/aws_sfn",
    new: "@langchain/community/agents/toolkits/aws_sfn",
    namedImport: "AWSSfnToolkitArgs",
  },
  {
    old: "langchain/agents/toolkits/aws_sfn",
    new: "@langchain/community/agents/toolkits/aws_sfn",
    namedImport: "AWSSfnToolkit",
  },
  {
    old: "langchain/agents/toolkits/aws_sfn",
    new: "@langchain/community/agents/toolkits/aws_sfn",
    namedImport: "createAWSSfnAgent",
  },
  {
    old: "langchain/stores/doc/gcs",
    new: "@langchain/community/stores/doc/gcs",
    namedImport: null,
  },
  {
    old: "langchain/agents/toolkits/connery/*",
    new: "@langchain/community/agents/toolkits/connery",
    namedImport: "ConneryToolkit",
  },
  {
    old: "langchain/embeddings/base",
    new: "@langchain/community/",
    namedImport: "Embeddings",
  },
  {
    old: "langchain/vectorstores/singlestore",
    new: "@langchain/community/",
    namedImport: "Metadata",
  },
  {
    old: "langchain/document_loaders/web/notionapi",
    new: "@langchain/community/",
    namedImport: "GetResponse",
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/generated",
    namedImport: "ConfigurationParameters",
  },
  {
    old: "langchain/llms/cohere",
    new: "@langchain/cohere",
    namedImport: "CohereInput",
  },
  {
    old: "langchain/llms/cohere",
    new: "@langchain/cohere",
    namedImport: "Cohere",
  },
  {
    old: "langchain/embeddings/cohere",
    new: "@langchain/cohere",
    namedImport: "CohereEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/cohere",
    new: "@langchain/cohere",
    namedImport: "CohereEmbeddings",
  },
  {
    old: "langchain/chat_models/cloudflare_workersai",
    new: "@langchain/cloudflare",
    namedImport: "ChatCloudflareWorkersAICallOptions",
  },
  {
    old: "langchain/chat_models/cloudflare_workersai",
    new: "@langchain/cloudflare",
    namedImport: "ChatCloudflareWorkersAI",
  },
  {
    old: "langchain/llms/cloudflare_workersai",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareWorkersAIInput",
  },
  {
    old: "langchain/llms/cloudflare_workersai",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareWorkersAI",
  },
  {
    old: "langchain/embeddings/cloudflare_workersai",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareWorkersAIEmbeddingsParams",
  },
  {
    old: "langchain/embeddings/cloudflare_workersai",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareWorkersAIEmbeddings",
  },
  {
    old: "langchain/vectorstores/cloudflare_vectorize",
    new: "@langchain/cloudflare",
    namedImport: "VectorizeLibArgs",
  },
  {
    old: "langchain/vectorstores/cloudflare_vectorize",
    new: "@langchain/cloudflare",
    namedImport: "VectorizeDeleteParams",
  },
  {
    old: "langchain/vectorstores/cloudflare_vectorize",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareVectorizeStore",
  },
  {
    old: "langchain/cache/cloudflare_kv",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareKVCache",
  },
  {
    old: "langchain/stores/message/cloudflare_d1",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareD1MessageHistoryInput",
  },
  {
    old: "langchain/stores/message/cloudflare_d1",
    new: "@langchain/cloudflare",
    namedImport: "CloudflareD1MessageHistory",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/cloudflare/utils/event_source_parse",
    namedImport: "getBytes",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/cloudflare/utils/event_source_parse",
    namedImport: "getLines",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/cloudflare/utils/event_source_parse",
    namedImport: "getMessages",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/cloudflare/utils/event_source_parse",
    namedImport: "convertEventStreamToIterableReadableDataStream",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/cloudflare/utils/event_source_parse",
    namedImport: "EventStreamContentType",
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/cloudflare/utils/event_source_parse",
    namedImport: "EventSourceMessage",
  },
  {
    old: "langchain/chat_models/anthropic",
    new: "@langchain/anthropic",
    namedImport: "AnthropicInput",
  },
  {
    old: "langchain/chat_models/anthropic",
    new: "@langchain/anthropic",
    namedImport: "ChatAnthropic",
  },
  {
    old: "langchain/text_splitter",
    new: "@langchain/textsplitters",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/zep",
    new: "@langchain/community/vectorstores/zep",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/xata",
    new: "@langchain/community/vectorstores/xata",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/weaviate",
    new: "@langchain/community/vectorstores/weaviate",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/voy",
    new: "@langchain/community/vectorstores/voy",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/vercel_postgres",
    new: "@langchain/community/vectorstores/vercel_postgres",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/vectara",
    new: "@langchain/community/vectorstores/vectara",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/usearch",
    new: "@langchain/community/vectorstores/usearch",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/typesense",
    new: "@langchain/community/vectorstores/typesense",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/typeorm",
    new: "@langchain/community/vectorstores/typeorm",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/tigris",
    new: "@langchain/community/vectorstores/tigris",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/supabase",
    new: "@langchain/community/vectorstores/supabase",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/singlestore",
    new: "@langchain/community/vectorstores/singlestore",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/rockset",
    new: "@langchain/community/vectorstores/rockset",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/redis",
    new: "@langchain/community/vectorstores/redis",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/qdrant",
    new: "@langchain/community/vectorstores/qdrant",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/prisma",
    new: "@langchain/community/vectorstores/prisma",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/pinecone",
    new: "@langchain/community/vectorstores/pinecone",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/pgvector",
    new: "@langchain/community/vectorstores/pgvector",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/opensearch",
    new: "@langchain/community/vectorstores/opensearch",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/neo4j_vector",
    new: "@langchain/community/vectorstores/neo4j_vector",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/myscale",
    new: "@langchain/community/vectorstores/myscale",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/mongodb_atlas",
    new: "@langchain/community/vectorstores/mongodb_atlas",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/momento_vector_/*",
    new: "@langchain/community/vectorstores/momento_vector_index",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/milvus",
    new: "@langchain/community/vectorstores/milvus",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/lancedb",
    new: "@langchain/community/vectorstores/lancedb",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/hnswlib",
    new: "@langchain/community/vectorstores/hnswlib",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/googlevertexai",
    new: "@langchain/community/vectorstores/googlevertexai",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/faiss",
    new: "@langchain/community/vectorstores/faiss",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/elasticsearch",
    new: "@langchain/community/vectorstores/elasticsearch",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/convex",
    new: "@langchain/community/vectorstores/convex",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/cloudflare_vectorize",
    new: "@langchain/community/vectorstores/cloudflare_vectorize",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/clickhouse",
    new: "@langchain/community/vectorstores/clickhouse",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/chroma",
    new: "@langchain/community/vectorstores/chroma",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/cassandra",
    new: "@langchain/community/vectorstores/cassandra",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/base",
    new: "@langchain/core/vectorstores",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/analyticdb",
    new: "@langchain/community/vectorstores/analyticdb",
    namedImport: null,
  },
  {
    old: "langchain/vectorstores/closevector/node",
    new: "@langchain/community/vectorstores/closevector/node",
    namedImport: null,
  },
  {
    old: "langchain/util/tiktoken",
    new: "@langchain/core/utils/tiktoken",
    namedImport: null,
  },
  {
    old: "langchain/util/stream",
    new: "@langchain/core/utils/stream",
    namedImport: null,
  },
  {
    old: "langchain/util/math",
    new: "@langchain/core/utils/math",
    namedImport: null,
  },
  {
    old: "langchain/util/event-source-parse",
    new: "@langchain/community/utils/event_source_parse",
    namedImport: null,
  },
  {
    old: "langchain/util/convex",
    new: "@langchain/community/util/convex",
    namedImport: null,
  },
  {
    old: "langchain/util/async_caller",
    new: "@langchain/core/utils/async_caller",
    namedImport: null,
  },
  {
    old: "langchain/tools/wolframalpha",
    new: "@langchain/community/tools/wolframalpha",
    namedImport: null,
  },
  {
    old: "langchain/tools/wikipedia_query_run",
    new: "@langchain/community/tools/wikipedia_query_run",
    namedImport: null,
  },
  {
    old: "langchain/tools/serper",
    new: "@langchain/community/tools/serper",
    namedImport: null,
  },
  {
    old: "langchain/tools/serpapi",
    new: "@langchain/community/tools/serpapi",
    namedImport: null,
  },
  {
    old: "langchain/tools/searxng_search",
    new: "@langchain/community/tools/searxng_search",
    namedImport: null,
  },
  {
    old: "langchain/tools/searchapi",
    new: "@langchain/community/tools/searchapi",
    namedImport: null,
  },
  {
    old: "langchain/tools/google_places",
    new: "@langchain/community/tools/google_places",
    namedImport: null,
  },
  {
    old: "langchain/tools/google_custom_search",
    new: "@langchain/community/tools/google_custom_search",
    namedImport: null,
  },
  {
    old: "langchain/tools/dynamic",
    new: "@langchain/community/tools/dynamic",
    namedImport: null,
  },
  {
    old: "langchain/tools/dataforseo_api_search",
    new: "@langchain/community/tools/dataforseo_api_search",
    namedImport: null,
  },
  {
    old: "langchain/tools/dadjokeapi",
    new: "@langchain/community/tools/dadjokeapi",
    namedImport: null,
  },
  {
    old: "langchain/tools/connery",
    new: "@langchain/community/tools/connery",
    namedImport: null,
  },
  {
    old: "langchain/tools/calculator",
    new: "@langchain/community/tools/calculator",
    namedImport: null,
  },
  {
    old: "langchain/tools/brave_search",
    new: "@langchain/community/tools/brave_search",
    namedImport: null,
  },
  {
    old: "langchain/tools/bingserpapi",
    new: "@langchain/community/tools/bingserpapi",
    namedImport: null,
  },
  {
    old: "langchain/tools/aws_sfn",
    new: "@langchain/community/tools/aws_sfn",
    namedImport: null,
  },
  {
    old: "langchain/tools/aws_lambda",
    new: "@langchain/community/tools/aws_lambda",
    namedImport: null,
  },
  {
    old: "langchain/tools/aiplugin",
    new: "@langchain/community/tools/aiplugin",
    namedImport: null,
  },
  {
    old: "langchain/tools/IFTTTWebhook",
    new: "@langchain/community/tools/ifttt",
    namedImport: null,
  },
  {
    old: "langchain/tools/gmail/*",
    new: "@langchain/community/tools/gmail",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/xata",
    new: "@langchain/community/stores/message/xata",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/upstash_redis",
    new: "@langchain/community/stores/message/upstash_redis",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/redis",
    new: "@langchain/community/stores/message/redis",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/planetscale",
    new: "@langchain/community/stores/message/planetscale",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/mongodb",
    new: "@langchain/community/stores/message/mongodb",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/momento",
    new: "@langchain/community/stores/message/momento",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/ioredis",
    new: "@langchain/community/stores/message/ioredis",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/in_memory",
    new: "@langchain/community/stores/message/in_memory",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/firestore",
    new: "@langchain/community/stores/message/firestore",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/dynamodb",
    new: "@langchain/community/stores/message/dynamodb",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/convex",
    new: "@langchain/community/stores/message/convex",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/cloudflare_d1",
    new: "@langchain/community/stores/message/cloudflare_d1",
    namedImport: null,
  },
  {
    old: "langchain/stores/message/cassandra",
    new: "@langchain/community/stores/message/cassandra",
    namedImport: null,
  },
  {
    old: "langchain/stores/doc/in_memory",
    new: "@langchain/community/stores/doc/in_memory",
    namedImport: null,
  },
  {
    old: "langchain/storage/vercel_kv",
    new: "@langchain/community/storage/vercel_kv",
    namedImport: null,
  },
  {
    old: "langchain/storage/upstash_redis",
    new: "@langchain/community/storage/upstash_redis",
    namedImport: null,
  },
  {
    old: "langchain/storage/ioredis",
    new: "@langchain/community/storage/ioredis",
    namedImport: null,
  },
  {
    old: "langchain/storage/convex",
    new: "@langchain/community/storage/convex",
    namedImport: null,
  },
  {
    old: "langchain/schema/storage",
    new: "@langchain/core/stores",
    namedImport: null,
  },
  {
    old: "langchain/schema/retriever",
    new: "@langchain/core/retrievers",
    namedImport: null,
  },
  {
    old: "langchain/schema/output_parser",
    new: "@langchain/core/output_parsers",
    namedImport: null,
  },
  {
    old: "langchain/schema/tests/lib",
    new: "@langchain/core/utils/testing",
    namedImport: null,
  },
  {
    old: "langchain/schema/runnable/*",
    new: "@langchain/core/runnables",
    namedImport: null,
  },
  {
    old: "langchain/runnables/remote",
    new: "@langchain/core/runnables/remote",
    namedImport: null,
  },
  {
    old: "langchain/runnables/*",
    new: "@langchain/core/runnables",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/zep",
    new: "@langchain/community/retrievers/zep",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/vespa",
    new: "@langchain/community/retrievers/vespa",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/vectara_summary",
    new: "@langchain/community/retrievers/vectara_summary",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/tavily_search_api",
    new: "@langchain/community/retrievers/tavily_search_api",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/supabase",
    new: "@langchain/community/retrievers/supabase",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/metal",
    new: "@langchain/community/retrievers/metal",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/databerry",
    new: "@langchain/community/retrievers/databerry",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/chaindesk",
    new: "@langchain/community/retrievers/chaindesk",
    namedImport: null,
  },
  {
    old: "langchain/retrievers/amazon_kendra",
    new: "@langchain/community/retrievers/amazon_kendra",
    namedImport: null,
  },
  {
    old: "langchain/prompts/selectors/SemanticSimilarityExampleSelector",
    new: "@langchain/core/example_selectors",
    namedImport: null,
  },
  {
    old: "langchain/memory/zep",
    new: "@langchain/community/memory/zep",
    namedImport: null,
  },
  {
    old: "langchain/memory/motorhead_memory",
    new: "@langchain/community/memory/motorhead_memory",
    namedImport: null,
  },
  {
    old: "langchain/memory/chat_memory",
    new: "@langchain/community/memory/chat_memory",
    namedImport: null,
  },
  {
    old: "langchain/memory/base",
    new: "@langchain/core/memory",
    namedImport: null,
  },
  {
    old: "langchain/load/serializable",
    new: "@langchain/core/load/serializable",
    namedImport: null,
  },
  {
    old: "langchain/llms/yandex",
    new: "@langchain/community/llms/yandex",
    namedImport: null,
  },
  {
    old: "langchain/llms/writer",
    new: "@langchain/community/llms/writer",
    namedImport: null,
  },
  {
    old: "langchain/llms/watsonx_ai",
    new: "@langchain/community/llms/watsonx_ai",
    namedImport: null,
  },
  {
    old: "langchain/llms/sagemaker_endpoint",
    new: "@langchain/community/llms/sagemaker_endpoint",
    namedImport: null,
  },
  {
    old: "langchain/llms/replicate",
    new: "@langchain/community/llms/replicate",
    namedImport: null,
  },
  {
    old: "langchain/llms/raycast",
    new: "@langchain/community/llms/raycast",
    namedImport: null,
  },
  {
    old: "langchain/llms/portkey",
    new: "@langchain/community/llms/portkey",
    namedImport: null,
  },
  {
    old: "langchain/llms/ollama",
    new: "@langchain/community/llms/ollama",
    namedImport: null,
  },
  {
    old: "langchain/llms/llama_cpp",
    new: "@langchain/community/llms/llama_cpp",
    namedImport: null,
  },
  {
    old: "langchain/llms/hf",
    new: "@langchain/community/llms/hf",
    namedImport: null,
  },
  {
    old: "langchain/llms/gradient_ai",
    new: "@langchain/community/llms/gradient_ai",
    namedImport: null,
  },
  {
    old: "langchain/llms/googlepalm",
    new: "@langchain/community/llms/googlepalm",
    namedImport: null,
  },
  {
    old: "langchain/llms/fireworks",
    new: "@langchain/community/llms/fireworks",
    namedImport: null,
  },
  {
    old: "langchain/llms/cohere",
    new: "@langchain/community/llms/cohere",
    namedImport: null,
  },
  {
    old: "langchain/llms/cloudflare_workersai",
    new: "@langchain/community/llms/cloudflare_workersai",
    namedImport: null,
  },
  {
    old: "langchain/llms/base",
    new: "@langchain/core/language_models/llms",
    namedImport: null,
  },
  {
    old: "langchain/llms/aleph_alpha",
    new: "@langchain/community/llms/aleph_alpha",
    namedImport: null,
  },
  {
    old: "langchain/llms/ai21",
    new: "@langchain/community/llms/ai21",
    namedImport: null,
  },
  {
    old: "langchain/llms/googlevertexai",
    new: "@langchain/community/llms/googlevertexai",
    namedImport: null,
  },
  {
    old: "langchain/llms/bedrock/web",
    new: "@langchain/community/llms/bedrock/web",
    namedImport: null,
  },
  {
    old: "langchain/graphs/neo4j_graph",
    new: "@langchain/community/graphs/neo4j_graph",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/voyage",
    new: "@langchain/community/embeddings/voyage",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/tensorflow",
    new: "@langchain/community/embeddings/tensorflow",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/ollama",
    new: "@langchain/community/embeddings/ollama",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/minimax",
    new: "@langchain/community/embeddings/minimax",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/llama_cpp",
    new: "@langchain/community/embeddings/llama_cpp",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/hf_transformers",
    new: "@langchain/community/embeddings/hf_transformers",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/hf",
    new: "@langchain/community/embeddings/hf",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/gradient_ai",
    new: "@langchain/community/embeddings/gradient_ai",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/googlevertexai",
    new: "@langchain/community/embeddings/googlevertexai",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/googlepalm",
    new: "@langchain/community/embeddings/googlepalm",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/fake",
    new: "@langchain/core/utils/testing",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/cohere",
    new: "@langchain/community/embeddings/cohere",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/cloudflare_workersai",
    new: "@langchain/community/embeddings/cloudflare_workersai",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/bedrock",
    new: "@langchain/community/embeddings/bedrock",
    namedImport: null,
  },
  {
    old: "langchain/embeddings/base",
    new: "@langchain/core/embeddings",
    namedImport: null,
  },
  {
    old: "langchain/document_transformers/mozilla_readability",
    new: "@langchain/community/document_transformers/mozilla_readability",
    namedImport: null,
  },
  {
    old: "langchain/document_transformers/html_to_text",
    new: "@langchain/community/document_transformers/html_to_text",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/yandex",
    new: "@langchain/community/chat_models/yandex",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/portkey",
    new: "@langchain/community/chat_models/portkey",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/ollama",
    new: "@langchain/community/chat_models/ollama",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/minimax",
    new: "@langchain/community/chat_models/minimax",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/llama_cpp",
    new: "@langchain/community/chat_models/llama_cpp",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/googlepalm",
    new: "@langchain/community/chat_models/googlepalm",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/fireworks",
    new: "@langchain/community/chat_models/fireworks",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/cloudflare_workersai",
    new: "@langchain/community/chat_models/cloudflare_workersai",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/base",
    new: "@langchain/core/language_models/chat_models",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/baiduwenxin",
    new: "@langchain/community/chat_models/baiduwenxin",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/iflytek_xinghuo",
    new: "@langchain/community/chat_models/iflytek_xinghuo",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/googlevertexai",
    new: "@langchain/community/chat_models/googlevertexai",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/googlevertexai",
    new: "@langchain/community/chat_models/googlevertexai",
    namedImport: null,
  },
  {
    old: "langchain/chat_models/bedrock",
    new: "@langchain/community/chat_models/bedrock",
    namedImport: null,
  },
  {
    old: "langchain/chains/query_constructor/ir",
    new: "@langchain/core/structured_query",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/promises",
    new: "@langchain/core/callbacks/promises",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/manager",
    new: "@langchain/core/callbacks/manager",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/base",
    new: "@langchain/core/callbacks/base",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/tracer_langchain",
    new: "@langchain/core/tracers/tracer_langchain",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/tracer",
    new: "@langchain/core/tracers/base",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/run_collector",
    new: "@langchain/core/tracers/run_collector",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/log_stream",
    new: "@langchain/core/tracers/log_stream",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/llmonitor",
    new: "@langchain/community/callbacks/handlers/llmonitor",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/initialize",
    new: "@langchain/core/tracers/initialize",
    namedImport: null,
  },
  {
    old: "langchain/callbacks/handlers/console",
    new: "@langchain/core/tracers/console",
    namedImport: null,
  },
  {
    old: "langchain/cache/upstash_redis",
    new: "@langchain/community/caches/upstash_redis",
    namedImport: null,
  },
  {
    old: "langchain/cache/momento",
    new: "@langchain/community/caches/momento",
    namedImport: null,
  },
  {
    old: "langchain/cache/ioredis",
    new: "@langchain/community/caches/ioredis",
    namedImport: null,
  },
  {
    old: "langchain/cache/cloudflare_kv",
    new: "@langchain/community/caches/cloudflare_kv",
    namedImport: null,
  },
  {
    old: "langchain/cache/base",
    new: "@langchain/core/caches",
    namedImport: null,
  },
  {
    old: "langchain/agents/toolkits/base",
    new: "@langchain/community/agents/toolkits/base",
    namedImport: null,
  },
  {
    old: "langchain/agents/toolkits/connery/*",
    new: "@langchain/community/agents/toolkits/connery",
    namedImport: null,
  },
  {
    old: "langchain/experimental/chat_models/ollama_functions",
    new: "@langchain/community/experimental/chat_models/ollama_functions",
    namedImport: null,
  },
  {
    old: "langchain/experimental/multimodal_embeddings/googlevertexai",
    new: "@langchain/community/experimental/multimodal_embeddings/googlevertexai",
    namedImport: null,
  },
];
