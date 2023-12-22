import {
  MessageType,
  type BaseMessage,
  MessageContent,
  AIMessage
} from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel
} from "@langchain/core/language_models/chat_models";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult
} from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import { CohereClient, Cohere } from "cohere-ai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NewTokenIndices } from "@langchain/core/callbacks/base";

/**
 * Input to chat model class.
 */
export interface CohereInput extends BaseChatModelParams {
  /**
   * The API key to use.
   * @default {process.env.COHERE_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default {"command"}
   */
  modelName?: string;
  /**
   * What sampling temperature to use, between 0.0 and 2.0.
   * Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
   * @default {0.3}
   */
  temperature?: number;
  /**
   * Whether or not to stream the response.
   * @default {false}
   */
  streaming?: boolean;
}

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

interface CohereChatCallOptions
  extends BaseLanguageModelCallOptions,
    Cohere.ChatRequest,
    Cohere.ChatStreamRequest {}

function convertMessagesToCohereMessages(
  messages: Array<BaseMessage>
): Array<Cohere.ChatMessage> {
  const getRole = (role: MessageType) => {
    switch (role) {
      case "human":
        return "USER";
      case "ai":
        return "CHATBOT";
      default:
        throw new Error(
          `Unknown message type: ${role}. Accepted types: 'human', 'ai'`
        );
    }
  };

  const getContent = (content: MessageContent): string => {
    if (typeof content === "string") {
      return content;
    }
    throw new Error(
      `ChatCohere does not support non text message content. Received: ${JSON.stringify(
        content,
        null,
        2
      )}`
    );
  };

  return messages.map((message) => ({
    role: getRole(message._getType()),
    message: getContent(message.content)
  }));
}

/**
 * Integration with a chat model.
 */
export class ChatCohere<
    CallOptions extends CohereChatCallOptions = CohereChatCallOptions
  >
  extends BaseChatModel<CallOptions>
  implements CohereInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatCohere";
  }

  lc_serializable = true;

  client: CohereClient;

  modelName = "command";

  temperature = 0.3;

  streaming = false;

  constructor(fields?: CohereInput) {
    super(fields ?? {});

    const token = fields?.apiKey ?? getEnvironmentVariable("COHERE_API_KEY");
    if (!token) {
      throw new Error("No API key provided for Cohere.");
    }

    this.client = new CohereClient({
      token
    });
    this.modelName = fields?.modelName ?? "command";
    this.temperature = fields?.temperature ?? this.temperature;
    this.streaming = fields?.streaming ?? this.streaming;
  }

  // Replace
  _llmType() {
    return "chat_cohere";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const cohereOptions = { ...options };

    // Delete BaseLanguageModelCallOptions
    delete cohereOptions.stop;
    delete cohereOptions.timeout;
    delete cohereOptions.signal;
    delete cohereOptions.runName;
    delete cohereOptions.tags;
    delete cohereOptions.metadata;
    delete cohereOptions.callbacks;
    delete cohereOptions.configurable;

    return cohereOptions;
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const cohereMessages = convertMessagesToCohereMessages(messages);
    // The last message in the array is the most recent, all other messages
    // are apart of the chat history.
    const message = cohereMessages[cohereMessages.length - 1].message;
    const chat_history: Cohere.ChatMessage[] = [];
    if (cohereMessages.length > 1) {
      chat_history.concat(cohereMessages.slice(0, -1));
    }
    const input = {
      ...params,
      message,
      chat_history
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
    const response = await this.client.chat(input);

    if ("token_count" in response) {
      const {
        response_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens
      } = response.token_count as Record<string, number>;

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
    }

    const generationInfo: Record<string, unknown> = { ...response };
    delete generationInfo.text;

    const generations: ChatGeneration[] = [
      {
        text: response.text,
        message: new AIMessage({
          content: response.text,
          additional_kwargs: generationInfo
        }),
        generationInfo
      }
    ];
    return {
      generations,
      llmOutput: { estimatedTokenUsage: tokenUsage }
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const cohereMessages = convertMessagesToCohereMessages(messages);
    // The last message in the array is the most recent, all other messages
    // are apart of the chat history.
    const message = cohereMessages[cohereMessages.length - 1].message;
    const chat_history: Cohere.ChatMessage[] = [];
    if (cohereMessages.length > 1) {
      chat_history.concat(cohereMessages.slice(0, -1));
    }
    const input = {
      ...params,
      message,
      chat_history
    };

    // All models have a built in `this.caller` property for retries
    const stream = await this.caller.call(async () =>
      this.client.chatStream(input)
    );
    for await (const chunk of stream) {
      if (chunk.eventType === "text-generation") {
        yield new ChatGenerationChunk({
          text: chunk.text,
          message: new AIMessageChunk({ content: chunk.text })
        });
        await runManager?.handleLLMNewToken(chunk.text);
      } else if (chunk.eventType !== "stream-end") {
        // Used for when the user uses their RAG/Search/other API
        // and the stream takes more actions then just text generation.
        yield new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: {
              ...chunk
            }
          }),
          generationInfo: {
            ...chunk
          }
        });
      } else {
        if ("text" in chunk.response) {
          yield new ChatGenerationChunk({
            text: chunk.response.text,
            message: new AIMessageChunk({
              content: chunk.response.text
            }),
            generationInfo: {
              ...chunk
            }
          });
        }
        break;
      }
    }
  }

  /** @ignore */
  _combineLLMOutput(...llmOutputs: CohereLLMOutput[]): CohereLLMOutput {
    return llmOutputs.reduce<{
      [key in keyof CohereLLMOutput]: Required<CohereLLMOutput[key]>;
    }>(
      (acc, llmOutput) => {
        if (llmOutput && llmOutput.estimatedTokenUsage) {
          let completionTokens = acc.estimatedTokenUsage?.completionTokens ?? 0;
          let promptTokens = acc.estimatedTokenUsage?.promptTokens ?? 0;
          let totalTokens = acc.estimatedTokenUsage?.totalTokens ?? 0;

          completionTokens +=
            llmOutput.estimatedTokenUsage.completionTokens ?? 0;
          promptTokens += llmOutput.estimatedTokenUsage.promptTokens ?? 0;
          totalTokens += llmOutput.estimatedTokenUsage.totalTokens ?? 0;

          acc.estimatedTokenUsage = {
            completionTokens,
            promptTokens,
            totalTokens
          };
        }
        return acc;
      },
      {
        estimatedTokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0
        }
      }
    );
  }
}

interface CohereLLMOutput {
  estimatedTokenUsage?: TokenUsage;
}
