/**
 * Serialized ids under the legacy `langchain` namespace, as written by older
 * JS packages and by Python's `langchain_core` today, mapped to the
 * `langchain_core` id of the same class.
 *
 * Mirrors `SERIALIZABLE_MAPPING` in Python's `langchain_core.load.mapping`,
 * limited to classes that exist in this package. Keys are the legacy id
 * joined with `/`.
 */
export const SERIALIZABLE_MAPPING: Record<string, readonly string[]> = {
  "langchain/schema/messages/AIMessage": [
    "langchain_core",
    "messages",
    "ai",
    "AIMessage",
  ],
  "langchain/schema/messages/AIMessageChunk": [
    "langchain_core",
    "messages",
    "ai",
    "AIMessageChunk",
  ],
  "langchain/schema/messages/BaseMessage": [
    "langchain_core",
    "messages",
    "base",
    "BaseMessage",
  ],
  "langchain/schema/messages/BaseMessageChunk": [
    "langchain_core",
    "messages",
    "base",
    "BaseMessageChunk",
  ],
  "langchain/schema/messages/ChatMessage": [
    "langchain_core",
    "messages",
    "chat",
    "ChatMessage",
  ],
  "langchain/schema/messages/FunctionMessage": [
    "langchain_core",
    "messages",
    "function",
    "FunctionMessage",
  ],
  "langchain/schema/messages/HumanMessage": [
    "langchain_core",
    "messages",
    "human",
    "HumanMessage",
  ],
  "langchain/schema/messages/SystemMessage": [
    "langchain_core",
    "messages",
    "system",
    "SystemMessage",
  ],
  "langchain/schema/messages/ToolMessage": [
    "langchain_core",
    "messages",
    "tool",
    "ToolMessage",
  ],
  "langchain/schema/messages/RemoveMessage": [
    "langchain_core",
    "messages",
    "modifier",
    "RemoveMessage",
  ],
  "langchain/schema/prompt_template/BasePromptTemplate": [
    "langchain_core",
    "prompts",
    "base",
    "BasePromptTemplate",
  ],
  "langchain/prompts/prompt/PromptTemplate": [
    "langchain_core",
    "prompts",
    "prompt",
    "PromptTemplate",
  ],
  "langchain/prompts/chat/MessagesPlaceholder": [
    "langchain_core",
    "prompts",
    "chat",
    "MessagesPlaceholder",
  ],
  "langchain/prompts/chat/ChatPromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "ChatPromptTemplate",
  ],
  "langchain/prompts/chat/HumanMessagePromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "HumanMessagePromptTemplate",
  ],
  "langchain/prompts/chat/SystemMessagePromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "SystemMessagePromptTemplate",
  ],
  "langchain/prompts/image/ImagePromptTemplate": [
    "langchain_core",
    "prompts",
    "image",
    "ImagePromptTemplate",
  ],
  "langchain/prompts/chat/BaseMessagePromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "BaseMessagePromptTemplate",
  ],
  "langchain/schema/document/Document": [
    "langchain_core",
    "documents",
    "base",
    "Document",
  ],
  "langchain/prompts/chat/AIMessagePromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "AIMessagePromptTemplate",
  ],
  "langchain/schema/runnable/RunnableBinding": [
    "langchain_core",
    "runnables",
    "base",
    "RunnableBinding",
  ],
  "langchain/schema/runnable/RunnableBranch": [
    "langchain_core",
    "runnables",
    "branch",
    "RunnableBranch",
  ],
  "langchain/schema/runnable/RunnableWithFallbacks": [
    "langchain_core",
    "runnables",
    "fallbacks",
    "RunnableWithFallbacks",
  ],
  "langchain/output_parsers/list/CommaSeparatedListOutputParser": [
    "langchain_core",
    "output_parsers",
    "list",
    "CommaSeparatedListOutputParser",
  ],
  "langchain/schema/runnable/RunnableParallel": [
    "langchain_core",
    "runnables",
    "base",
    "RunnableParallel",
  ],
  "langchain/schema/output/ChatGenerationChunk": [
    "langchain_core",
    "outputs",
    "chat_generation",
    "ChatGenerationChunk",
  ],
  "langchain/schema/messages/ChatMessageChunk": [
    "langchain_core",
    "messages",
    "chat",
    "ChatMessageChunk",
  ],
  "langchain/schema/messages/HumanMessageChunk": [
    "langchain_core",
    "messages",
    "human",
    "HumanMessageChunk",
  ],
  "langchain/schema/messages/FunctionMessageChunk": [
    "langchain_core",
    "messages",
    "function",
    "FunctionMessageChunk",
  ],
  "langchain/schema/messages/SystemMessageChunk": [
    "langchain_core",
    "messages",
    "system",
    "SystemMessageChunk",
  ],
  "langchain/schema/messages/ToolMessageChunk": [
    "langchain_core",
    "messages",
    "tool",
    "ToolMessageChunk",
  ],
  "langchain/schema/output/GenerationChunk": [
    "langchain_core",
    "outputs",
    "generation",
    "GenerationChunk",
  ],
  "langchain/schema/prompt_template/BaseChatPromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "BaseChatPromptTemplate",
  ],
  "langchain/prompts/chat/ChatMessagePromptTemplate": [
    "langchain_core",
    "prompts",
    "chat",
    "ChatMessagePromptTemplate",
  ],
  "langchain/prompts/base/StringPromptValue": [
    "langchain_core",
    "prompt_values",
    "StringPromptValue",
  ],
  "langchain/prompts/chat/ChatPromptValue": [
    "langchain_core",
    "prompt_values",
    "ChatPromptValue",
  ],
  "langchain/schema/runnable/RouterRunnable": [
    "langchain_core",
    "runnables",
    "router",
    "RouterRunnable",
  ],
  "langchain/schema/runnable/RunnablePassthrough": [
    "langchain_core",
    "runnables",
    "passthrough",
    "RunnablePassthrough",
  ],
  "langchain/schema/runnable/RunnableSequence": [
    "langchain_core",
    "runnables",
    "base",
    "RunnableSequence",
  ],
  "langchain/schema/runnable/RunnableEach": [
    "langchain_core",
    "runnables",
    "base",
    "RunnableEach",
  ],
  "langchain/schema/runnable/RunnableWithMessageHistory": [
    "langchain_core",
    "runnables",
    "history",
    "RunnableWithMessageHistory",
  ],
  "langchain/schema/runnable/RunnableAssign": [
    "langchain_core",
    "runnables",
    "passthrough",
    "RunnableAssign",
  ],
  "langchain/schema/runnable/RunnablePick": [
    "langchain_core",
    "runnables",
    "passthrough",
    "RunnablePick",
  ],
  "langchain/schema/runnable/RunnableRetry": [
    "langchain_core",
    "runnables",
    "retry",
    "RunnableRetry",
  ],
};
