import { logVersion100SimpleMigrationWarning } from "../util/entrypoint_deprecation.js";

export { BufferMemory, type BufferMemoryInput } from "./buffer_memory.js";
export {
  BaseMemory,
  getInputValue,
  getOutputValue,
  getBufferString,
  type InputValues,
  type OutputValues,
  type MemoryVariables,
} from "./base.js";
export {
  ConversationSummaryMemory,
  type ConversationSummaryMemoryInput,
  BaseConversationSummaryMemory,
  type BaseConversationSummaryMemoryInput,
} from "./summary.js";
export {
  BufferWindowMemory,
  type BufferWindowMemoryInput,
} from "./buffer_window_memory.js";
export { BaseChatMemory, type BaseChatMemoryInput } from "./chat_memory.js";
export { ChatMessageHistory } from "../stores/message/in_memory.js";
export {
  VectorStoreRetrieverMemory,
  type VectorStoreRetrieverMemoryParams,
} from "./vector_store.js";
export { EntityMemory } from "./entity_memory.js";
export { ENTITY_MEMORY_CONVERSATION_TEMPLATE } from "./prompt.js";
export { type CombinedMemoryInput, CombinedMemory } from "./combined_memory.js";
export {
  ConversationSummaryBufferMemory,
  type ConversationSummaryBufferMemoryInput,
} from "./summary_buffer.js";
export {
  ConversationTokenBufferMemory,
  type ConversationTokenBufferMemoryInput,
} from "./buffer_token_memory.js";

logVersion100SimpleMigrationWarning({
  oldEntrypointName: "memory",
  customMessage: [
    "LangChain memory classes are now deprecated in favor of LangGraph memory.",
    "",
    "Please install LangGraph:",
    "",
    "  npm install @langchain/langgraph",
    "",
    "For more information, please see the migration guide: https://js.langchain.com/docs/versions/migrating_memory/",
  ].join("\n"),
});
