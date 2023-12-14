import {
  MessageType,
  type BaseMessage,
  MessageContent,
  AIMessage,
  HumanMessage,
  HumanMessageChunk,
  AIMessageChunk,
} from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import MistralClient, {
  type ChatCompletionResult as MistralAIChatCompletionResult,
  type ChatCompletionOptions as MistralAIChatCompletionOptions,
  type Message as MistralAIInputMessage,
} from "@mistralai/mistralai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
} from "@langchain/core/language_models/chat_models";

import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NewTokenIndices } from "@langchain/core/callbacks/base";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

/**
 * Input to chat model class.
 */
export interface ChatMistralAIInput extends BaseChatModelParams {
  /**
   * The API key to use.
   * @default {process.env.MISTRAL_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default {"mistral-small"}
   */
  modelName?: string;
  /**
   * Override the default endpoint.
   */
  endpoint?: string;
  /**
   * What sampling temperature to use, between 0.0 and 2.0.
   * Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
   * @default {0.7}
   */
  temperature?: number;
  /**
   * Nucleus sampling, where the model considers the results of the tokens with `top_p` probability mass.
   * So 0.1 means only the tokens comprising the top 10% probability mass are considered.
   * Should be between 0 and 1.
   * @default {1}
   */
  topP?: number;
  /**
   * The maximum number of tokens to generate in the completion.
   * The token count of your prompt plus max_tokens cannot exceed the model's context length.
   */
  maxTokens?: number;
  /**
   * Whether or not to stream the response.
   * @default {false}
   */
  streaming?: boolean;
  /**
   * Whether to inject a safety prompt before all conversations.
   * @default {false}
   */
  safeMode?: boolean;
  /**
   * The seed to use for random sampling. If set, different calls will generate deterministic results.
   */
  randomSeed?: number;
}

function convertMessagesToMistralMessages(
  messages: Array<BaseMessage>
): Array<MistralAIInputMessage> {
  const getRole = (role: MessageType) => {
    switch (role) {
      case "human":
        return "user";
      case "ai":
        return "assistant";
      case "system":
        return "system";
      default:
        throw new Error(`Unknown message type: ${role}`);
    }
  };

  const getContent = (content: MessageContent): string => {
    if (typeof content === "string") {
      return content;
    }
    throw new Error(
      `ChatMistralAI does not support non text message content. Received: ${JSON.stringify(
        content,
        null,
        2
      )}`
    );
  };

  return messages.map((message) => ({
    role: getRole(message._getType()),
    content: getContent(message.content),
  }));
}

function mistralAIResponseToChatMessage(
  choice: MistralAIChatCompletionResult["choices"][0]
): BaseMessage {
  if ("delta" in choice && !("message" in choice)) {
    return new AIMessage(choice.delta?.content ?? "");
  }
  if (!("message" in choice) || !choice.message) {
    throw new Error("No message found in the choice.");
  }

  const { message } = choice;
  switch (message.role) {
    case "assistant":
      return new AIMessage(message.content ?? "");
    default:
      return new HumanMessage(message.content ?? "");
  }
}

function _convertDeltaToMessageChunk(delta: {
  role?: "user" | "assistant";
  content?: string;
}) {
  const role = delta.role ?? "assistant";
  const content = delta.content ?? "";
  if (role === "user") {
    return new HumanMessageChunk({ content });
  }
  return new AIMessageChunk({ content });
}

/**
 * Integration with a chat model.
 */
export class ChatMistralAI<
    CallOptions extends BaseLanguageModelCallOptions = BaseLanguageModelCallOptions
  >
  extends BaseChatModel<CallOptions>
  implements ChatMistralAIInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatMistralAI";
  }

  modelName = "mistral-small";

  client = new MistralClient();

  temperature = 0.7;

  streaming = false;

  topP = 1;

  maxTokens: number;

  safeMode = false;

  randomSeed?: number;

  lc_serializable = true;

  constructor(fields?: ChatMistralAIInput) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("MISTRAL_API_KEY");
    if (!apiKey) {
      throw new Error(
        "API key MISTRAL_API_KEY is missing for MistralAI, but it is required."
      );
    }
    this.client = new MistralClient(apiKey, fields?.endpoint);
  }

  _llmType() {
    return "mistral_ai";
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<MistralAIChatCompletionOptions, "messages"> {
    const params = {
      model: this.modelName,
      temperature: this.temperature,
      topP: this.topP,
      maxTokens: this.maxTokens,
      safeMode: this.safeMode,
      randomSeed: this.randomSeed,
    };
    return params;
  }

  /**
   * Calls the MistralAI API with retry logic in case of failures.
   * @param {MistralAIChatCompletionOptions} input The input to send to the MistralAI API.
   * @returns {Promise<MistralAIChatCompletionResult | AsyncGenerator<MistralAIChatCompletionResult>>} The response from the MistralAI API.
   */
  async completionWithRetry(
    input: MistralAIChatCompletionOptions,
    streaming: true
  ): Promise<AsyncGenerator<MistralAIChatCompletionResult>>;

  async completionWithRetry(
    input: MistralAIChatCompletionOptions,
    streaming: false
  ): Promise<MistralAIChatCompletionResult>;

  async completionWithRetry(
    input: MistralAIChatCompletionOptions,
    streaming: boolean
  ): Promise<
    | MistralAIChatCompletionResult
    | AsyncGenerator<MistralAIChatCompletionResult>
  > {
    return this.caller.call(async () => {
      let res:
        | MistralAIChatCompletionResult
        | AsyncGenerator<MistralAIChatCompletionResult>;
      if (streaming) {
        res = this.client.chatStream(input);
      } else {
        res = await this.client.chat(input);
      }
      return res;
    });
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams();
    const mistralMessages = convertMessagesToMistralMessages(messages);
    const input = {
      ...params,
      messages: mistralMessages,
    };

    // Handle streaming
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
    }

    // Not streaming, so we can just call the API once.
    const response = await this.completionWithRetry(input, false);

    const {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: totalTokens,
    } = response?.usage ?? {};

    if (completionTokens) {
      tokenUsage.completionTokens =
        (tokenUsage.completionTokens ?? 0) + completionTokens;
    }

    if (promptTokens) {
      tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + promptTokens;
    }

    if (totalTokens) {
      tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + totalTokens;
    }

    const generations: ChatGeneration[] = [];
    for (const part of response?.choices ?? []) {
      if ("delta" in part) {
        throw new Error("Delta not supported in non-streaming mode.");
      }
      if (!("message" in part)) {
        throw new Error("No message found in the choice.");
      }
      const text = part.message?.content ?? "";
      const generation: ChatGeneration = {
        text,
        message: mistralAIResponseToChatMessage(part),
      };
      if (part.finish_reason) {
        generation.generationInfo = { finish_reason: part.finish_reason };
      }
      generations.push(generation);
    }
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const mistralMessages = convertMessagesToMistralMessages(messages);
    const params = this.invocationParams();
    const input = {
      ...params,
      messages: mistralMessages,
    };

    const streamIterable = await this.completionWithRetry(input, true);
    for await (const data of streamIterable) {
      const choice = data?.choices[0];
      if (!choice || !("delta" in choice)) {
        continue;
      }

      const { delta } = choice;
      if (!delta) {
        continue;
      }
      const newTokenIndices = {
        prompt: 0,
        completion: choice.index ?? 0,
      };
      const generationChunk = new ChatGenerationChunk({
        message: _convertDeltaToMessageChunk(delta),
        text: delta.content ?? "",
        generationInfo: newTokenIndices,
      });
      yield generationChunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
