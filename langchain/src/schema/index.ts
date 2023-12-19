import type { OpenAIClient } from "@langchain/openai";
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Serializable } from "../load/serializable.js";

export {
  type AgentAction,
  type AgentFinish,
  type AgentStep,
} from "@langchain/core/agents";

export { RUN_KEY } from "@langchain/core/outputs";

export { type Example } from "@langchain/core/prompts";

// TODO: Deprecate when SDK typing is updated
export type OpenAIToolCall = OpenAIClient.ChatCompletionMessageToolCall & {
  index: number;
};

export {
  type StoredMessageData,
  type StoredMessage,
  type StoredGeneration,
  type MessageType,
  type MessageContent,
  type BaseMessageFields,
  type ChatMessageFieldsWithRole,
  type FunctionMessageFieldsWithName,
  type ToolMessageFieldsWithToolCallId,
  BaseMessageChunk,
  HumanMessageChunk,
  AIMessageChunk,
  SystemMessageChunk,
  FunctionMessage,
  FunctionMessageChunk,
  ToolMessage,
  ToolMessageChunk,
  ChatMessage,
  type BaseMessageLike,
  mapStoredMessageToChatMessage,
  ChatMessageChunk,
  coerceMessageLikeToMessage,
  isBaseMessage,
  isBaseMessageChunk,
} from "@langchain/core/messages";

export { BaseMessage, HumanMessage, AIMessage, SystemMessage };

/**
 * @deprecated
 * Use {@link BaseMessage} instead.
 */
export const BaseChatMessage = BaseMessage;

/**
 * @deprecated
 * Use {@link HumanMessage} instead.
 */
export const HumanChatMessage = HumanMessage;

/**
 * @deprecated
 * Use {@link AIMessage} instead.
 */
export const AIChatMessage = AIMessage;

/**
 * @deprecated
 * Use {@link SystemMessage} instead.
 */
export const SystemChatMessage = SystemMessage;

export {
  type Generation,
  type GenerationChunkFields,
  GenerationChunk,
  type ChatResult,
  type ChatGeneration,
  ChatGenerationChunk,
  type LLMResult,
} from "@langchain/core/outputs";

export { BasePromptValue } from "@langchain/core/prompt_values";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export {
  type InputValues,
  type PartialValues,
  type ChainValues,
} from "@langchain/core/utils/types";

export {
  BaseChatMessageHistory,
  BaseListChatMessageHistory,
} from "@langchain/core/chat_history";

export { BaseCache } from "@langchain/core/caches";

/**
 * Base class for all file stores. All file stores should extend this
 * class.
 */
export abstract class BaseFileStore extends Serializable {
  abstract readFile(path: string): Promise<string>;

  abstract writeFile(path: string, contents: string): Promise<void>;
}

/**
 * Base class for all entity stores. All entity stores should extend this
 * class.
 */
export abstract class BaseEntityStore extends Serializable {
  abstract get(key: string, defaultValue?: string): Promise<string | undefined>;

  abstract set(key: string, value?: string): Promise<void>;

  abstract delete(key: string): Promise<void>;

  abstract exists(key: string): Promise<boolean>;

  abstract clear(): Promise<void>;
}

export { Docstore } from "@langchain/community/stores/doc/base";
