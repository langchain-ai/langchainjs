import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  HumanMessageChunk,
} from "@langchain/core/messages";
import {
  type BaseLanguageModelCallOptions,
  TokenUsage,
} from "@langchain/core/language_models/base";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
} from "@langchain/core/language_models/chat_models";

import Prem, {
  ChatCompletionStreamingCompletionData,
  CreateChatCompletionRequest,
  CreateChatCompletionResponse,
} from "@premai/prem-sdk";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";

import { NewTokenIndices } from "@langchain/core/callbacks/base";

export type RoleEnum = "user" | "assistant";

/**
 * Input to chat model class.
 */
export interface ChatPremInput extends BaseChatModelParams {
  project_id?: number | string;
  session_id?: string;
  messages?: {
    role: "user" | "assistant";
    content: string;
    [k: string]: unknown;
  }[];
  model?: string;
  system_prompt?: string;
  frequency_penalty?: number;
  logit_bias?: { [k: string]: unknown };
  max_tokens?: number;
  n?: number;
  presence_penalty?: number;
  response_format?: { [k: string]: unknown };
  seed?: number;
  stop?: string;
  temperature?: number;
  top_p?: number;
  tools?: { [k: string]: unknown }[];
  user?: string;
  /**
   * The Prem API key to use for requests.
   * @default process.env.PREM_API_KEY
   */
  apiKey?: string;
  streaming?: boolean;
}

export interface ChatCompletionCreateParamsNonStreaming
  extends CreateChatCompletionRequest {
  stream?: false;
}

export interface ChatCompletionCreateParamsStreaming
  extends CreateChatCompletionRequest {
  stream: true;
}

export type ChatCompletionCreateParams =
  | ChatCompletionCreateParamsNonStreaming
  | ChatCompletionCreateParamsStreaming;

function extractGenericMessageCustomRole(message: ChatMessage) {
  if (message.role !== "assistant" && message.role !== "user") {
    console.warn(`Unknown message role: ${message.role}`);
  }
  return message.role as RoleEnum;
}

export function messageToPremRole(message: BaseMessage): RoleEnum {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function convertMessagesToPremParams(
  messages: BaseMessage[]
): Array<CreateChatCompletionResponse["choices"]["0"]["message"]> {
  return messages.map((message) => {
    if (typeof message.content !== "string") {
      throw new Error("Non string message content not supported");
    }
    return {
      role: messageToPremRole(message),
      content: message.content,
      name: message.name,
      function_call: message.additional_kwargs.function_call,
    };
  });
}

function premResponseToChatMessage(
  message: CreateChatCompletionResponse["choices"]["0"]["message"]
): BaseMessage {
  switch (message.role) {
    case "assistant":
      return new AIMessage(message.content as string);
    default:
      return new ChatMessage(
        message.content as string,
        message.role ?? "unknown"
      );
  }
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>
) {
  const { role } = delta;
  const content = delta.content ?? "";
  let additional_kwargs;
  if (delta.function_call) {
    additional_kwargs = {
      function_call: delta.function_call,
    };
  } else {
    additional_kwargs = {};
  }
  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

/**
 * Integration with a chat model.
 */
export class ChatPrem<
    CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
  >
  extends BaseChatModel<CallOptions>
  implements ChatPremInput
{
  client: Prem;

  apiKey?: string;

  project_id: number;

  session_id?: string;

  messages: {
    [k: string]: unknown;
    role: "user" | "assistant";
    content: string;
  }[];

  model?: string;

  system_prompt?: string;

  frequency_penalty?: number;

  logit_bias?: { [k: string]: unknown };

  max_tokens?: number;

  n?: number;

  presence_penalty?: number;

  response_format?: { [k: string]: unknown };

  seed?: number;

  stop?: string;

  temperature?: number;

  top_p?: number;

  tools?: { [k: string]: unknown }[];

  user?: string;

  streaming = false;

  [k: string]: unknown;

  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatPrem";
  }

  lc_serializable = true;

  /**
   * Replace with any secrets this class passes to `super`.
   * See {@link ../../langchain-cohere/src/chat_model.ts} for
   * an example.
   */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "PREM_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "PREM_API_KEY",
    };
  }

  constructor(fields?: ChatPremInput) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("PREM_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Prem API key not found. Please set the PREM_API_KEY environment variable or provide the key into "apiKey"`
      );
    }

    const projectId =
      fields?.project_id ??
      parseInt(getEnvironmentVariable("PREM_PROJECT_ID") ?? "-1", 10);
    if (!projectId || projectId === -1 || typeof projectId !== "number") {
      throw new Error(
        `Prem project ID not found. Please set the PREM_PROJECT_ID environment variable or provide the key into "project_id"`
      );
    }

    this.client = new Prem({
      apiKey,
    });

    this.project_id = projectId;
    this.session_id = fields?.session_id ?? this.session_id;
    this.messages = fields?.messages ?? this.messages;
    this.model = fields?.model ?? this.model;
    this.system_prompt = fields?.system_prompt ?? this.system_prompt;
    this.frequency_penalty =
      fields?.frequency_penalty ?? this.frequency_penalty;
    this.logit_bias = fields?.logit_bias ?? this.logit_bias;
    this.max_tokens = fields?.max_tokens ?? this.max_tokens;
    this.n = fields?.n ?? this.n;
    this.presence_penalty = fields?.presence_penalty ?? this.presence_penalty;
    this.response_format = fields?.response_format ?? this.response_format;
    this.seed = fields?.seed ?? this.seed;
    this.stop = fields?.stop ?? this.stop;
    this.temperature = fields?.temperature ?? this.temperature;
    this.top_p = fields?.top_p ?? this.top_p;
    this.tools = fields?.tools ?? this.tools;
    this.user = fields?.user ?? this.user;
    this.streaming = fields?.streaming ?? this.streaming;
  }

  // Replace
  _llmType() {
    return "prem";
  }

  async completionWithRetry(
    request: ChatCompletionCreateParamsStreaming,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: any
  ): Promise<AsyncIterable<ChatCompletionStreamingCompletionData>>;

  async completionWithRetry(
    request: ChatCompletionCreateParams,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: any
  ): Promise<CreateChatCompletionResponse>;

  async completionWithRetry(
    request: ChatCompletionCreateParamsStreaming,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: any
  ): Promise<
    | AsyncIterable<ChatCompletionStreamingCompletionData>
    | CreateChatCompletionResponse
  > {
    return this.caller.call(async () =>
      this.client.chat.completions.create(request, options)
    );
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const params = super.invocationParams(options);
    return {
      ...params,
      project_id: this.project_id,
      session_id: this.session_id,
      messages: this.messages,
      model: this.model,
      system_prompt: this.system_prompt,
      frequency_penalty: this.frequency_penalty,
      logit_bias: this.logit_bias,
      max_tokens: this.max_tokens,
      n: this.n,
      presence_penalty: this.presence_penalty,
      response_format: this.response_format,
      seed: this.seed,
      stop: this.stop,
      temperature: this.temperature,
      top_p: this.top_p,
      tools: this.tools,
      user: this.user,
      streaming: this.streaming,
      stream: this.streaming,
    };
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToPremParams(messages);

    // All models have a built-in `this.caller` property for retries
    const stream = await this.caller.call(async () =>
      this.completionWithRetry(
        {
          ...params,
          messages: messagesMapped,
          stream: true,
        },
        params
      )
    );

    for await (const data of stream) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const chunk = new ChatGenerationChunk({
        message: _convertDeltaToMessageChunk(choice.delta ?? {}),
        text: choice.delta.content ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
        },
      });
      yield chunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToPremParams(messages);

    if (params.streaming) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        const index =
          (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        if (finalChunks[index] === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = finalChunks[index].concat(chunk);
        }
      }
      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([_, value]) => value);

      return { generations, llmOutput: { estimatedTokenUsage: tokenUsage } };
    } else {
      const data = await this.completionWithRetry(
        {
          ...params,
          stream: false,
          messages: messagesMapped,
        },
        {
          signal: options?.signal,
        }
      );

      if ("usage" in data && data.usage) {
        const {
          completion_tokens: completionTokens,
          prompt_tokens: promptTokens,
          total_tokens: totalTokens,
        } = data.usage as CreateChatCompletionResponse["usage"];

        if (completionTokens) {
          tokenUsage.completionTokens =
            (tokenUsage.completionTokens ?? 0) + completionTokens;
        }

        if (promptTokens) {
          tokenUsage.promptTokens =
            (tokenUsage.promptTokens ?? 0) + promptTokens;
        }

        if (totalTokens) {
          tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + totalTokens;
        }
      }

      const generations: ChatGeneration[] = [];

      if ("choices" in data && data.choices) {
        for (const part of (data as unknown as CreateChatCompletionResponse)
          .choices) {
          const text = part.message?.content ?? "";
          const generation: ChatGeneration = {
            text: text as string,
            message: premResponseToChatMessage(
              part.message ?? { role: "assistant" }
            ),
          };
          generation.generationInfo = {
            ...(part.finish_reason
              ? { finish_reason: part.finish_reason }
              : {}),
            ...(part.logprobs ? { logprobs: part.logprobs } : {}),
          };
          generations.push(generation);
        }
      }

      return {
        generations,
        llmOutput: { tokenUsage },
      };
    }
  }
}
