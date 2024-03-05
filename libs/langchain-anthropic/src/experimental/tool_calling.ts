import { BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BasePromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropic, type AnthropicInput } from "../chat_models.js";
import {
  DEFAULT_TOOL_SYSTEM_PROMPT,
  prepareAndParseToolCall,
  type ChatAnthropicToolsCallOptions,
} from "./utils/tool_calling.js";

export type ChatAnthropicToolsInput = Partial<AnthropicInput> &
  BaseChatModelParams & {
    llm?: BaseChatModel;
    systemPromptTemplate?: BasePromptTemplate;
  };

/**
 * Experimental wrapper over Anthropic chat models that adds support for
 * a function calling interface.
 */
export class ChatAnthropicTools extends BaseChatModel<ChatAnthropicToolsCallOptions> {
  llm: BaseChatModel;

  stopSequences?: string[];

  systemPromptTemplate: BasePromptTemplate;

  lc_namespace = ["langchain", "experimental", "chat_models"];

  static lc_name(): string {
    return "ChatAnthropicTools";
  }

  constructor(fields?: ChatAnthropicToolsInput) {
    super(fields ?? {});
    this.llm = fields?.llm ?? new ChatAnthropic(fields);
    this.systemPromptTemplate =
      fields?.systemPromptTemplate ?? DEFAULT_TOOL_SYSTEM_PROMPT;
    this.stopSequences =
      fields?.stopSequences ?? (this.llm as ChatAnthropic).stopSequences;
  }

  invocationParams() {
    return this.llm.invocationParams();
  }

  /** @ignore */
  _identifyingParams() {
    return this.llm._identifyingParams();
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    yield* this.llm._streamResponseChunks(messages, options, runManager);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    return prepareAndParseToolCall({
      messages,
      options,
      systemPromptTemplate: this.systemPromptTemplate,
      stopSequences: this.stopSequences ?? [],
      llm: this.llm,
    });
  }

  _llmType(): string {
    return "anthropic_tool_calling";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
