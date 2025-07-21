import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  ChatMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import {
  BaseChatModel,
  BaseChatModelParams,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import OpenAI from "openai";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  RunnableSequence,
  Runnable,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  TokenUsage,
} from "@langchain/core/language_models/base";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  JsonOutputParser,
  StructuredOutputParser,
  type BaseLLMOutputParser,
} from "@langchain/core/output_parsers";
import {
  ReasoningJsonOutputParser,
  ReasoningStructuredOutputParser,
} from "../utils/output_parsers.js";

/**
 * Type representing the role of a message in the Perplexity chat model.
 */
export type PerplexityRole = "system" | "user" | "assistant";

export interface WebSearchOptions {
  /**
   * Determines how much search context is retrieved for the model.
   * Options are: low (minimizes context for cost savings but less comprehensive answers), medium (balanced approach suitable for most queries), and high (maximizes context for comprehensive answers but at higher cost).
   */
  search_context_size?: "low" | "medium" | "high";

  /**
   * To refine search results based on geography, you can specify an approximate user location.
   */
  user_location?: {
    /**
     * The latitude of the user's location.
     */
    latitude: number;

    /**
     * The longitude of the user's location.
     */
    longitude: number;

    /**
     * The two letter ISO country code of the user's location.
     */
    country: string;
  };
}

/**
 * Interface defining the parameters for the Perplexity chat model.
 */
export interface PerplexityChatInput extends BaseChatModelParams {
  /** Model name to use */
  model: string;

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

  /** Controls the search mode used for the request. When set to 'academic', results will prioritize scholarly sources. */
  searchMode?: "academic" | "web";

  /** Controls how much computational effort the AI dedicates to each query for deep research models. Only applicable for sonar-deep-research. */
  reasoningEffort?: "low" | "medium" | "high";

  /** Filters search results to only include content published after this date. */
  searchAfterDateFilter?: string;

  /** Filters search results to only include content published before this date. */
  searchBeforeDateFilter?: string;

  /**
   * Configuration for using web search in model responses.
   */
  webSearchOptions?: WebSearchOptions;
}

export interface PerplexityChatCallOptions extends BaseChatModelCallOptions {
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      description: string;
      schema: Record<string, unknown>;
    };
  };
}

/**
 * Wrapper around Perplexity large language models that use the Chat endpoint.
 */
export class ChatPerplexity
  extends BaseChatModel<PerplexityChatCallOptions>
  implements PerplexityChatInput
{
  static lc_name() {
    return "ChatPerplexity";
  }

  model: string;

  temperature?: number;

  maxTokens?: number;

  apiKey?: string;

  timeout?: number;

  streaming?: boolean;

  topP?: number;

  searchDomainFilter?: any[];

  returnImages?: boolean;

  returnRelatedQuestions?: boolean;

  searchRecencyFilter?: string;

  topK?: number;

  presencePenalty?: number;

  frequencyPenalty?: number;

  searchMode?: "academic" | "web";

  reasoningEffort?: "low" | "medium" | "high";

  searchAfterDateFilter?: string;

  searchBeforeDateFilter?: string;

  webSearchOptions?: WebSearchOptions;

  private client: OpenAI;

  constructor(fields: PerplexityChatInput) {
    super(fields ?? {});

    this.model = fields.model;
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
    this.searchDomainFilter =
      fields?.searchDomainFilter ?? this.searchDomainFilter;
    this.searchRecencyFilter =
      fields?.searchRecencyFilter ?? this.searchRecencyFilter;
    this.searchMode = fields?.searchMode;
    this.reasoningEffort = fields?.reasoningEffort;
    this.searchAfterDateFilter = fields?.searchAfterDateFilter;
    this.searchBeforeDateFilter = fields?.searchBeforeDateFilter;
    this.webSearchOptions = fields?.webSearchOptions;

    if (!this.apiKey) {
      throw new Error("Perplexity API key not found");
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
  invocationParams(options?: this["ParsedCallOptions"]) {
    return {
      model: this.model as string,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      stream: this.streaming,
      top_p: this.topP,
      return_images: this.returnImages,
      return_related_questions: this.returnRelatedQuestions,
      top_k: this.topK,
      presence_penalty: this.presencePenalty,
      frequency_penalty: this.frequencyPenalty,
      response_format: options?.response_format,
      search_domain_filter: this.searchDomainFilter,
      search_recency_filter: this.searchRecencyFilter,
      search_mode: this.searchMode,
      reasoning_effort: this.reasoningEffort,
      search_after_date_filter: this.searchAfterDateFilter,
      search_before_date_filter: this.searchBeforeDateFilter,
      web_search_options: this.webSearchOptions as Record<string, unknown>, // Cast WebSearchOptions to generic type to avoid conflict with OpenAI's WebSearchOptions interface
    };
  }

  /**
   * Convert a message to a format that the model expects
   */
  private messageToPerplexityRole(message: BaseMessage): {
    role: PerplexityRole;
    content: string;
  } {
    if (message._getType() === "human") {
      return {
        role: "user",
        content: message.content.toString(),
      };
    } else if (message._getType() === "ai") {
      return {
        role: "assistant",
        content: message.content.toString(),
      };
    } else if (message._getType() === "system") {
      return {
        role: "system",
        content: message.content.toString(),
      };
    }
    throw new Error(`Unknown message type: ${message}`);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const messagesList = messages.map((message) =>
      this.messageToPerplexityRole(message)
    );

    if (this.streaming) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        const index =
          (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        if (finalChunks[index] === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = concat(finalChunks[index], chunk);
        }
      }

      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([_, value]) => value);
      return { generations };
    }

    const response = await this.client.chat.completions.create({
      messages: messagesList,
      ...this.invocationParams(options),
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

    if (response.usage) {
      tokenUsage.promptTokens = response.usage.prompt_tokens;
      tokenUsage.completionTokens = response.usage.completion_tokens;
      tokenUsage.totalTokens = response.usage.total_tokens;
    }

    return {
      generations,
      llmOutput: {
        tokenUsage,
      },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesList = messages.map((message) =>
      this.messageToPerplexityRole(message)
    );

    const stream = await this.client.chat.completions.create({
      messages: messagesList,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...this.invocationParams(options),
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
        generationInfo: {
          finishReason: choice.finish_reason,
        },
      });

      yield generationChunk;

      // Emit the chunk to the callback manager if provided
      if (runManager) {
        await runManager.handleLLMNewToken(delta.content);
      }
    }
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      > {
    if (config?.strict) {
      throw new Error(`"strict" mode is not supported for this model.`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: InteropZodType<RunOutput> | Record<string, any> = outputSchema;
    if (isInteropZodSchema(schema)) {
      schema = toJsonSchema(schema);
    }
    const name = config?.name;
    const description =
      schema.description ?? "Format to use when returning your response";
    const method = config?.method ?? "jsonSchema";
    const includeRaw = config?.includeRaw;
    if (method !== "jsonSchema") {
      throw new Error(
        `Perplexity only supports "jsonSchema" as a structured output method.`
      );
    }
    const llm: Runnable<BaseLanguageModelInput> = this.withConfig({
      response_format: {
        type: "json_schema",
        json_schema: {
          name: name ?? "extract",
          description,
          schema,
        },
      },
    });

    let outputParser: BaseLLMOutputParser;
    // Check if this is a reasoning model
    const isReasoningModel = this.model.toLowerCase().includes("reasoning");

    if (isInteropZodSchema(schema)) {
      if (isReasoningModel) {
        outputParser = new ReasoningStructuredOutputParser(schema);
      } else {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      }
    } else {
      if (isReasoningModel) {
        outputParser = new ReasoningJsonOutputParser(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    }

    if (!includeRaw) {
      return llm.pipe(outputParser) as Runnable<
        BaseLanguageModelInput,
        RunOutput
      >;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]);
  }
}
