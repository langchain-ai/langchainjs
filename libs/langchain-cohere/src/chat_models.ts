import { CohereClient, Cohere } from "cohere-ai";

import {
  MessageType,
  type BaseMessage,
  MessageContent,
  AIMessage,
} from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
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
import { AIMessageChunk } from "@langchain/core/messages";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NewTokenIndices } from "@langchain/core/callbacks/base";

/**
 * Input interface for ChatCohere
 */
export interface ChatCohereInput extends BaseChatModelParams {
  /**
   * The API key to use.
   * @default {process.env.COHERE_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default {"command"}
   */
  model?: string;
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
    Partial<Omit<Cohere.ChatRequest, "message">>,
    Partial<Omit<Cohere.ChatStreamRequest, "message">> {}

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
          `Unknown message type: '${role}'. Accepted types: 'human', 'ai'`
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
    message: getContent(message.content),
  }));
}

/**
 * Integration with ChatCohere
 * @example
 * ```typescript
 * const model = new ChatCohere({
 *   apiKey: process.env.COHERE_API_KEY, // Default
 *   model: "command" // Default
 * });
 * const response = await model.invoke([
 *   new HumanMessage("How tall are the largest pengiuns?")
 * ]);
 * ```
 */
export class ChatCohere<
    CallOptions extends CohereChatCallOptions = CohereChatCallOptions
  >
  extends BaseChatModel<CallOptions>
  implements ChatCohereInput
{
  static lc_name() {
    return "ChatCohere";
  }

  lc_serializable = true;

  client: CohereClient;

  model = "command";

  temperature = 0.3;

  streaming = false;

  constructor(fields?: ChatCohereInput) {
    super(fields ?? {});

    const token = fields?.apiKey ?? getEnvironmentVariable("COHERE_API_KEY");
    if (!token) {
      throw new Error("No API key provided for ChatCohere.");
    }

    this.client = new CohereClient({
      token,
    });
    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.streaming = fields?.streaming ?? this.streaming;
  }

  _llmType() {
    return "cohere";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const params = {
      model: this.model,
      preambleOverride: options.preambleOverride,
      conversationId: options.conversationId,
      promptTruncation: options.promptTruncation,
      connectors: options.connectors,
      searchQueriesOnly: options.searchQueriesOnly,
      documents: options.documents,
      citationQuality: options.citationQuality,
      temperature: options.temperature ?? this.temperature,
    };
    // Filter undefined entries
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
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
    const { message } = cohereMessages[cohereMessages.length - 1];
    const chat_history: Cohere.ChatMessage[] = [];
    if (cohereMessages.length > 1) {
      chat_history.concat(cohereMessages.slice(0, -1));
    }
    const input = {
      ...params,
      message,
      chat_history,
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
    const response: Cohere.NonStreamedChatResponse =
      await this.caller.callWithOptions(
        { signal: options.signal },
        async () => {
          let response;
          try {
            response = await this.client.chat(input);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            e.status = e.status ?? e.statusCode;
            throw e;
          }
          return response;
        }
      );

    if ("token_count" in response) {
      const {
        response_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
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
          additional_kwargs: generationInfo,
        }),
        generationInfo,
      },
    ];
    return {
      generations,
      llmOutput: { estimatedTokenUsage: tokenUsage },
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
    const { message } = cohereMessages[cohereMessages.length - 1];
    const chat_history: Cohere.ChatMessage[] = [];
    if (cohereMessages.length > 1) {
      chat_history.concat(cohereMessages.slice(0, -1));
    }
    const input = {
      ...params,
      message,
      chat_history,
    };

    // All models have a built in `this.caller` property for retries
    const stream = await this.caller.call(async () => {
      let stream;
      try {
        stream = await this.client.chatStream(input);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        e.status = e.status ?? e.statusCode;
        throw e;
      }
      return stream;
    });
    for await (const chunk of stream) {
      if (chunk.eventType === "text-generation") {
        yield new ChatGenerationChunk({
          text: chunk.text,
          message: new AIMessageChunk({ content: chunk.text }),
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
              ...chunk,
            },
          }),
          generationInfo: {
            ...chunk,
          },
        });
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
            totalTokens,
          };
        }
        return acc;
      },
      {
        estimatedTokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      }
    );
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "COHERE_API_KEY",
      api_key: "COHERE_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "cohere_api_key",
      api_key: "cohere_api_key",
    };
  }
}

interface CohereLLMOutput {
  estimatedTokenUsage?: TokenUsage;
}
