import {
  MessageType,
  type BaseMessage,
  MessageContent,
  AIMessage,
  HumanMessage,
  HumanMessageChunk,
  AIMessageChunk
} from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import MistralClient, {
  type ChatCompletionResult as MistralAIChatCompletionResult
} from "@mistralai/mistralai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  SimpleChatModel
} from "@langchain/core/language_models/chat_models";

import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/** @TODO move to shared, exported file */
interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

interface MistralAIInputMessage {
  role: "user" | "agent";
  content: string;
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
   * @default {"mistral-tiny"}
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

const convertMessagesToMistralMessages = (
  messages: Array<BaseMessage>
): Array<MistralAIInputMessage> => {
  const getRole = (role: MessageType) => {
    if (role === "function" || role === "tool") {
      throw new Error(
        "ChatMistralAI does not support function or tool messages."
      );
    }
    if (role === "human") {
      return "user";
    }
    return "agent";
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
    content: getContent(message.content)
  }));
};

function openAIResponseToChatMessage(
  choice: MistralAIChatCompletionResult["choices"][0]
): BaseMessage {
  if ("delta" in choice && !("message" in choice)) {
    return new AIMessage(choice.delta?.content ?? "");
  }
  if (
    !("message" in choice) ||
    !choice.message ||
    choice.message.length === 0
  ) {
    throw new Error("No message found in the choice.");
  }
  const message = choice.message[0];
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
  extends SimpleChatModel<CallOptions>
  implements ChatMistralAIInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatMistralAI";
  }

  modelName = "mistral-tiny";

  apiKey = getEnvironmentVariable("MISTRAL_API_KEY");

  client: MistralClient;

  temperature = 0.7;

  streaming = false;

  topP = 1;

  maxTokens: number;

  safeMode = false;

  randomSeed?: number;

  lc_serializable = true;

  constructor(fields?: ChatMistralAIInput) {
    super(fields ?? {});
    this.apiKey = fields?.apiKey ?? this.apiKey;
    if (!this.apiKey) {
      throw new Error("API key missing for MistralAI, but it is required.");
    }
    this.client = new MistralClient(this.apiKey, fields?.endpoint);
  }

  // Replace
  _llmType() {
    return "chat_integration";
  }

  /**
   * For some given input messages and options, return a string output.
   */
  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const chatResponse = await this._generate(messages, options, runManager);
    const content = chatResponse.generations[0].message.content;
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
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams() {
    const params = {
      model: this.modelName,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
      safe_mode: this.safeMode,
      random_seed: this.randomSeed
    };
    return params;
  }

  async completionWithRetry(
    messages: Array<MistralAIInputMessage>,
    params: any
  ): Promise<
    MistralAIChatCompletionResult | AsyncIterable<MistralAIChatCompletionResult>
  > {
    return this.caller.call(async () => {
      try {
        const res = await this.client.chat({
          ...params,
          messages
        });
        return res;
      } catch (e) {
        // wrap error like openai?
        throw e;
      }
    });
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};

    const params = this.invocationParams();
    const mistralMessages = convertMessagesToMistralMessages(messages);
    if (this.streaming) {
      // handle streaming
    }

    const response = (await this.completionWithRetry(
      mistralMessages,
      params
    )) as MistralAIChatCompletionResult;

    const {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: totalTokens
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
      const text = part.message?.[0]?.content ?? "";
      const generation: ChatGeneration = {
        text,
        message: openAIResponseToChatMessage(part)
      };
      if (part.finish_reason) {
        generation.generationInfo = { finish_reason: part.finish_reason };
      }
      generations.push(generation);
    }
    return {
      generations,
      llmOutput: { tokenUsage }
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
    const mistralMessages = convertMessagesToMistralMessages(messages);
    const params = this.invocationParams();

    const streamIterable = (await this.completionWithRetry(
      mistralMessages,
      params
    )) as AsyncIterable<MistralAIChatCompletionResult>;
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
        completion: choice.index ?? 0
      };
      const generationChunk = new ChatGenerationChunk({
        message: _convertDeltaToMessageChunk(delta),
        text: delta.content ?? "",
        generationInfo: newTokenIndices
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
