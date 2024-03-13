import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { type OpenAICoreRequestOptions } from "@langchain/openai";
import Groq from "groq-sdk";
import { ChatCompletionChunk } from "groq-sdk/lib/chat_completions_ext";
import {
  ChatCompletion,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from "groq-sdk/resources/chat/completions";

export interface ChatGroqCallOptions extends BaseChatModelCallOptions {}

export interface ChatGroqInput extends BaseChatModelParams {
  /**
   * The Groq API key to use for requests.
   * @default process.env.GROQ_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default "llama2-70b-4096"
   */
  modelName?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   */
  stop?: string | null | Array<string>;
  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;
  /**
   * The temperature to use for sampling.
   * @default 0.7
   */
  temperature?: number;
}

type GroqRoleEnum = "system" | "assistant" | "user" | "function";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export function messageToGroqRole(message: BaseMessage): GroqRoleEnum {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function convertMessagesToGroqParams(
  messages: BaseMessage[]
): Array<ChatCompletion.Choice.Message> {
  return messages.map((message) => {
    if (typeof message.content !== "string") {
      throw new Error("Non string message content not supported");
    }
    return {
      role: messageToGroqRole(message),
      content: message.content,
      name: message.name,
      function_call: message.additional_kwargs.function_call,
    };
  });
}

function groqResponseToChatMessage(
  message: ChatCompletion.Choice.Message
): BaseMessage {
  switch (message.role) {
    case "assistant":
      return new AIMessage(message.content || "");
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
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
  } else if (role === "system") {
    return new SystemMessageChunk({ content });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

/**
 * Wrapper around Groq API for large language models fine-tuned for chat
 *
 * Groq API is compatible to the OpenAI API with some limitations. View the
 * full API ref at:
 * @link {https://docs.api.groq.com/md/openai.oas.html}
 *
 * To use, you should have the `GROQ_API_KEY` environment variable set.
 * @example
 * ```typescript
 * const model = new ChatGroq({
 *   temperature: 0.9,
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 *
 * const response = await model.invoke([new HumanMessage("Hello there!")]);
 * console.log(response);
 * ```
 */
export class ChatGroq extends BaseChatModel<ChatGroqCallOptions> {
  client: Groq;

  modelName = "llama2-70b-4096";

  temperature = 0.7;

  stop?: string[];

  streaming = false;

  static lc_name() {
    return "ChatGroq";
  }

  _llmType() {
    return "groq";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GROQ_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(fields?: ChatGroqInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey || getEnvironmentVariable("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Groq API key not found. Please set the GROQ_API_KEY environment variable or provide the key into "apiKey"`
      );
    }

    this.client = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    this.temperature = fields?.temperature ?? this.temperature;
    this.modelName = fields?.modelName ?? this.modelName;
    this.streaming = fields?.streaming ?? this.streaming;
    this.stop =
      (typeof fields?.stop === "string" ? [fields.stop] : fields?.stop) ?? [];
  }

  async completionWithRetry(
    request: ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<ChatCompletionChunk>>;

  async completionWithRetry(
    request: ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<ChatCompletion>;

  async completionWithRetry(
    request: ChatCompletionCreateParams,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<ChatCompletionChunk> | ChatCompletion> {
    return this.caller.call(async () =>
      this.client.chat.completions.create(request, options)
    );
  }

  invocationParams(
    options: this["ParsedCallOptions"]
  ): ChatCompletionCreateParams {
    const params = super.invocationParams(options);
    return {
      ...params,
      stop: options.stop ?? this.stop,
      model: this.modelName,
      temperature: this.temperature,
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToGroqParams(messages);
    const response = await this.completionWithRetry(
      {
        ...params,
        messages: messagesMapped,
        stream: true,
      },
      params
    );
    for await (const data of response) {
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
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToGroqParams(messages);

    if (this.streaming) {
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
        } = data.usage as ChatCompletion.Usage;

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
        for (const part of (data as ChatCompletion).choices) {
          const text = part.message?.content ?? "";
          const generation: ChatGeneration = {
            text,
            message: groqResponseToChatMessage(
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
