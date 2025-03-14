import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  ChatMessage,
  ChatMessageChunk,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  SystemMessageChunk,
} from "@langchain/core/messages";
import {
  BaseChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import OpenAI from "openai";

/**
 * Type representing the role of a message in the Perplexity chat model.
 */
export type PerplexityRole = "system" | "user" | "assistant";

/**
 * Interface defining the parameters for the Perplexity chat model.
 */
export interface PerplexityChatInput {
  /** Model name to use */
  model?: string;

  /** Maximum number of tokens to generate */
  maxTokens?: number;

  /** Temperature parameter between 0 and 2 */
  temperature?: number;

  /** Top P parameter between 0 and 1 */
  topP?: number;

  /** Search domain filter - limit the citations used by the online model to URLs from the specified domains. */
  searchDomainFilter?: any[];

  /** Whether to return images */
  returnImages?: boolean;

  /** Determines whether or not a request to an online model should return related questions. */
  returnRelatedQuestions?: boolean;

  /** Returns search results within the specified time interval - does not apply to images. Values include month, week, day, hour. */
  searchRecencyFilter?: string;

  /** Top K parameter between 1 and 2048 */
  topK?: number;

  /** Presence penalty between -2 and 2 */
  presencePenalty?: number;

  /** Frequency penalty greater than 0 */
  frequencyPenalty?: number;

  /** API key for Perplexity.  Defaults to the value of
   * PERPLEXITY_API_KEY environment variable.
   */
  apiKey?: string;

  /** Whether to stream the results or not */
  streaming?: boolean;

  /** Timeout for requests to Perplexity */
  timeout?: number;
}

/**
 * Wrapper around Perplexity large language models that use the Chat endpoint.
 */
export class ChatPerplexity
  extends BaseChatModel
  implements PerplexityChatInput
{
  static lc_name() {
    return "ChatPerplexity";
  }

  model?: string;

  temperature?: number;

  maxTokens?: number;

  apiKey?: string;

  timeout?: number;

  streaming?: boolean;

  topP?: number;

  returnImages?: boolean;

  returnRelatedQuestions?: boolean;

  topK?: number;

  presencePenalty?: number;

  frequencyPenalty?: number;

  private client: OpenAI;

  constructor(fields?: Partial<PerplexityChatInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens;
    this.apiKey =
      fields?.apiKey ?? getEnvironmentVariable("PERPLEXITY_API_KEY");
    this.streaming = fields?.streaming ?? this.streaming;
    this.timeout = fields?.timeout;
    this.topP = fields?.topP ?? this.topP;
    this.returnImages = fields?.returnImages ?? this.returnImages;
    this.returnRelatedQuestions =
      fields?.returnRelatedQuestions ?? this.returnRelatedQuestions;
    this.topK = fields?.topK ?? this.topK;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;

    if (!this.apiKey) {
      throw new Error("Perplexity API key not found");
    }

    if (!this.model) {
      throw new Error("Perplexity model not found");
    }

    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.perplexity.ai",
    });
  }

  _llmType() {
    return "perplexity";
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams() {
    return {
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: this.streaming,
      top_p: this.topP,
      return_images: this.returnImages,
      return_related_questions: this.returnRelatedQuestions,
      top_k: this.topK,
      presence_penalty: this.presencePenalty,
      frequency_penalty: this.frequencyPenalty,
    };
  }

  /**
   * Convert a message to a format that the model expects
   */
  private messageToPerplexityRole(message: BaseMessage): {
    role: PerplexityRole;
    content: string;
  } {
    if (message instanceof ChatMessage) {
      return {
        role: message.role as PerplexityRole,
        content: message.content.toString(),
      };
    }
    if (message instanceof HumanMessage) {
      return {
        role: "user",
        content: message.content.toString(),
      };
    }
    if (message instanceof AIMessage) {
      return {
        role: "assistant",
        content: message.content.toString(),
      };
    }
    if (message instanceof SystemMessage) {
      return {
        role: "system",
        content: message.content.toString(),
      };
    }
    throw new Error(`Unknown message type: ${message}`);
  }

  async _generate(
    messages: BaseMessage[],
    _options?: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const messagesList = messages.map((message) =>
      this.messageToPerplexityRole(message)
    );

    const response = await this.client.chat.completions.create({
      messages: messagesList,
      ...this.invocationParams(),
      stream: false,
    });

    const { message } = response.choices[0];

    const generations: ChatGeneration[] = [];

    generations.push({
      text: message.content ?? "",
      message: new AIMessage({
        content: message.content ?? "",
        additional_kwargs: {
          citations: (response as any).citations,
        },
      }),
    });

    return {
      generations,
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesList = messages.map((message) =>
      this.messageToPerplexityRole(message)
    );

    const stream = await this.client.chat.completions.create({
      messages: messagesList,
      ...this.invocationParams(),
      stream: true,
    });

    let firstChunk = true;
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const { delta } = choice;
      const citations = (chunk as any).citations ?? [];

      if (!delta.content) continue;

      let messageChunk: BaseMessageChunk;
      if (delta.role === "user") {
        messageChunk = new HumanMessageChunk({ content: delta.content });
      } else if (delta.role === "assistant") {
        messageChunk = new AIMessageChunk({ content: delta.content });
      } else if (delta.role === "system") {
        messageChunk = new SystemMessageChunk({ content: delta.content });
      } else {
        messageChunk = new ChatMessageChunk({
          content: delta.content,
          role: delta.role ?? "assistant",
        });
      }

      if (firstChunk) {
        messageChunk.additional_kwargs.citations = citations;
        firstChunk = false;
      }

      const generationChunk = new ChatGenerationChunk({
        message: messageChunk,
        text: delta.content,
      });

      yield generationChunk;

      // Emit the chunk to the callback manager if provided
      if (runManager) {
        await runManager.handleLLMNewToken(delta.content);
      }
    }
  }
}
