import {
  BaseChatModel,
  type BaseChatModelParams,
  BindToolsInput,
  type BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  type ToolMessage,
  isAIMessage,
  type UsageMetadata,
  ChatMessage,
  type AIMessageChunk,
} from "@langchain/core/messages";
import {
  convertLangChainToolCallToOpenAI,
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import { type ChatResult, type ChatGeneration } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Runnable } from "@langchain/core/runnables";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";

export const DEFAULT_MODEL = "meta-llama/Meta-Llama-3-70B-Instruct" as const;

export type DeepInfraMessageRole = "system" | "assistant" | "user" | "tool";

export const API_BASE_URL =
  "https://api.deepinfra.com/v1/openai/chat/completions";

export const ENV_VARIABLE_API_KEY = "DEEPINFRA_API_TOKEN";

type DeepInfraFinishReason = "stop" | "length" | "tool_calls" | "null" | null;

interface DeepInfraToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface DeepInfraMessage {
  role: DeepInfraMessageRole;
  content: string;
  tool_calls?: DeepInfraToolCall[];
}

/**
 * @see https://deepinfra.com/models/text-generation
 */
export type DeepInfraChatModelId =
  | 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
  | 'meta-llama/Llama-4-Scout-17B-16E-Instruct'
  | 'meta-llama/Llama-3.3-70B-Instruct'
  | 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
  | 'meta-llama/Meta-Llama-3.1-70B-Instruct'
  | 'meta-llama/Meta-Llama-3.1-8B-Instruct'
  | 'meta-llama/Meta-Llama-3.1-405B-Instruct'
  | 'Qwen/QwQ-32B-Preview'
  | 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo'
  | 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  | 'Qwen/Qwen2.5-Coder-32B-Instruct'
  | 'nvidia/Llama-3.1-Nemotron-70B-Instruct'
  | 'Qwen/Qwen2.5-72B-Instruct'
  | 'meta-llama/Llama-3.2-90B-Vision-Instruct'
  | 'meta-llama/Llama-3.2-11B-Vision-Instruct'
  | 'microsoft/WizardLM-2-8x22B'
  | '01-ai/Yi-34B-Chat'
  | 'Austism/chronos-hermes-13b-v2'
  | 'Gryphe/MythoMax-L2-13b'
  | 'Gryphe/MythoMax-L2-13b-turbo'
  | 'HuggingFaceH4/zephyr-orpo-141b-A35b-v0.1'
  | 'KoboldAI/LLaMA2-13B-Tiefighter'
  | 'NousResearch/Hermes-3-Llama-3.1-405B'
  | 'Phind/Phind-CodeLlama-34B-v2'
  | 'Qwen/Qwen2-72B-Instruct'
  | 'Qwen/Qwen2-7B-Instruct'
  | 'Qwen/Qwen2.5-7B-Instruct'
  | 'Qwen/Qwen2.5-Coder-7B'
  | 'Sao10K/L3-70B-Euryale-v2.1'
  | 'Sao10K/L3-8B-Lunaris-v1'
  | 'Sao10K/L3.1-70B-Euryale-v2.2'
  | 'bigcode/starcoder2-15b'
  | 'bigcode/starcoder2-15b-instruct-v0.1'
  | 'codellama/CodeLlama-34b-Instruct-hf'
  | 'codellama/CodeLlama-70b-Instruct-hf'
  | 'cognitivecomputations/dolphin-2.6-mixtral-8x7b'
  | 'cognitivecomputations/dolphin-2.9.1-llama-3-70b'
  | 'databricks/dbrx-instruct'
  | 'deepinfra/airoboros-70b'
  | 'deepseek-ai/DeepSeek-V3'
  | 'google/codegemma-7b-it'
  | 'google/gemma-1.1-7b-it'
  | 'google/gemma-2-27b-it'
  | 'google/gemma-2-9b-it'
  | 'lizpreciatior/lzlv_70b_fp16_hf'
  | 'mattshumer/Reflection-Llama-3.1-70B'
  | 'meta-llama/Llama-2-13b-chat-hf'
  | 'meta-llama/Llama-2-70b-chat-hf'
  | 'meta-llama/Llama-2-7b-chat-hf'
  | 'meta-llama/Llama-3.2-1B-Instruct'
  | 'meta-llama/Llama-3.2-3B-Instruct'
  | 'meta-llama/Meta-Llama-3-70B-Instruct'
  | 'meta-llama/Meta-Llama-3-8B-Instruct'
  | 'microsoft/Phi-3-medium-4k-instruct'
  | 'microsoft/WizardLM-2-7B'
  | 'mistralai/Mistral-7B-Instruct-v0.1'
  | 'mistralai/Mistral-7B-Instruct-v0.2'
  | 'mistralai/Mistral-7B-Instruct-v0.3'
  | 'mistralai/Mistral-Nemo-Instruct-2407'
  | 'mistralai/Mixtral-8x22B-Instruct-v0.1'
  | 'mistralai/Mixtral-8x22B-v0.1'
  | 'mistralai/Mixtral-8x7B-Instruct-v0.1'
  | 'nvidia/Nemotron-4-340B-Instruct'
  | 'openbmb/MiniCPM-Llama3-V-2_5'
  | 'openchat/openchat-3.6-8b'
  | 'openchat/openchat_3.5'
  | (string & NonNullable<unknown>);

interface ChatCompletionRequest {
  model: DeepInfraChatModelId;
  messages?: DeepInfraMessage[];
  stream?: boolean;
  max_tokens?: number | null;
  temperature?: number | null;
  tools?: BindToolsInput[];
  stop?: string[];
}

interface BaseResponse {
  code?: string;
  message?: string;
}

interface ChoiceMessage {
  role: string;
  content: string;
  tool_calls?: DeepInfraToolCall[];
}

interface ResponseChoice {
  index: number;
  finish_reason: DeepInfraFinishReason;
  delta: ChoiceMessage;
  message: ChoiceMessage;
}

interface ChatCompletionResponse extends BaseResponse {
  choices: ResponseChoice[];
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  output: {
    text: string;
    finish_reason: DeepInfraFinishReason;
  };
}

export interface DeepInfraCallOptions extends BaseChatModelCallOptions {
  stop?: string[];
  tools?: BindToolsInput[];
}

export interface ChatDeepInfraParams {
  model: DeepInfraChatModelId;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

function messageToRole(message: BaseMessage): DeepInfraMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    case "tool":
      return "tool";
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function convertMessagesToDeepInfraParams(
  messages: BaseMessage[]
): DeepInfraMessage[] {
  return messages.map((message): DeepInfraMessage => {
    if (typeof message.content !== "string") {
      throw new Error("Non string message content not supported");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionParam: Record<string, any> = {
      role: messageToRole(message),
      content: message.content,
    };
    if (message.name != null) {
      completionParam.name = message.name;
    }
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
      completionParam.content = "";
    } else {
      if (message.additional_kwargs.tool_calls != null) {
        completionParam.tool_calls = message.additional_kwargs.tool_calls;
      }
      if ((message as ToolMessage).tool_call_id != null) {
        completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
      }
    }
    return completionParam as DeepInfraMessage;
  });
}

function deepInfraResponseToChatMessage(
  message: ChoiceMessage,
  usageMetadata?: UsageMetadata
): BaseMessage {
  switch (message.role) {
    case "assistant": {
      const toolCalls = [];
      const invalidToolCalls = [];
      for (const rawToolCall of message.tool_calls ?? []) {
        try {
          toolCalls.push(parseToolCall(rawToolCall, { returnId: true }));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          invalidToolCalls.push(makeInvalidToolCall(rawToolCall, e.message));
        }
      }
      return new AIMessage({
        content: message.content || "",
        additional_kwargs: { tool_calls: message.tool_calls ?? [] },
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
        usage_metadata: usageMetadata,
      });
    }
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

export class ChatDeepInfra
  extends BaseChatModel<DeepInfraCallOptions>
  implements ChatDeepInfraParams
{
  static lc_name() {
    return "ChatDeepInfra";
  }

  get callKeys() {
    return ["stop", "signal", "options", "tools"];
  }

  apiKey?: string;

  model: DeepInfraChatModelId;

  apiUrl: string;

  maxTokens?: number;

  temperature?: number;

  constructor(fields: Partial<ChatDeepInfraParams> & BaseChatModelParams = {}) {
    super(fields);

    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable(ENV_VARIABLE_API_KEY);
    if (!this.apiKey) {
      throw new Error(
        "API key is required, set `DEEPINFRA_API_TOKEN` environment variable or pass it as a parameter"
      );
    }

    this.apiUrl = API_BASE_URL;
    this.model = fields.model ?? DEFAULT_MODEL;
    this.temperature = fields.temperature ?? 0;
    this.maxTokens = fields.maxTokens;
  }

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<ChatCompletionRequest, "messages"> {
    if (options?.tool_choice) {
      throw new Error(
        "Tool choice is not supported for ChatDeepInfra currently."
      );
    }
    return {
      model: this.model,
      stream: false,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      tools: options?.tools,
      stop: options?.stop,
    };
  }

  identifyingParams(): Omit<ChatCompletionRequest, "messages"> {
    return this.invocationParams();
  }

  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const parameters = this.invocationParams(options);
    const messagesMapped = convertMessagesToDeepInfraParams(messages);

    const data: ChatCompletionResponse = await this.completionWithRetry(
      { ...parameters, messages: messagesMapped },
      false,
      options?.signal
    );

    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
    } = data.usage ?? {};

    const usageMetadata: UsageMetadata = {
      input_tokens: prompt_tokens,
      output_tokens: completion_tokens,
      total_tokens,
    };
    const generations: ChatGeneration[] = [];

    for (const part of data?.choices ?? []) {
      const text = part.message?.content ?? "";
      const generation: ChatGeneration = {
        text,
        message: deepInfraResponseToChatMessage(part.message, usageMetadata),
      };
      if (part.finish_reason) {
        generation.generationInfo = { finish_reason: part.finish_reason };
      }
      generations.push(generation);
    }

    return {
      generations,
      llmOutput: {
        tokenUsage: {
          promptTokens: prompt_tokens,
          completionTokens: completion_tokens,
          totalTokens: total_tokens,
        },
      },
    };
  }

  async completionWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal
  ): Promise<ChatCompletionResponse> {
    const body = {
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      ...request,
      model: this.model,
    };

    const makeCompletionRequest = async () => {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!stream) {
        return response.json();
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<DeepInfraCallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, DeepInfraCallOptions> {
    return this.withConfig({
      tools: tools.map((tool) => convertToOpenAITool(tool)),
      ...kwargs,
    } as DeepInfraCallOptions);
  }

  _llmType(): string {
    return "DeepInfra";
  }
}
