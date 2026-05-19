import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  ChatMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  UsageMetadata,
} from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
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
} from "./utils/output_parsers.js";

/**
 * Type representing the role of a message in the Perplexity chat model.
 */
export type PerplexityRole = "system" | "user" | "assistant";

export interface WebSearchOptions {
  /**
   * Determines how much search context is retrieved for the model.
   * Options: low (minimizes context for cost savings), medium (balanced),
   * and high (maximizes context for comprehensive answers).
   */
  search_context_size?: "low" | "medium" | "high";

  /**
   * Approximate user location used to refine search results.
   */
  user_location?: {
    /** Latitude of the user's location. */
    latitude: number;
    /** Longitude of the user's location. */
    longitude: number;
    /** Two-letter ISO country code. */
    country: string;
  };
}

/**
 * Input parameters for the Perplexity chat model.
 */
export interface PerplexityChatInput extends BaseChatModelParams {
  /** Model name to use (e.g. "sonar", "sonar-pro", "sonar-reasoning"). */
  model: string;

  /** Maximum number of tokens to generate. */
  maxTokens?: number;

  /** Sampling temperature between 0 and 2. */
  temperature?: number;

  /** Top-p (nucleus sampling) parameter between 0 and 1. */
  topP?: number;

  /** Limit citations to URLs from these domains. */
  searchDomainFilter?: unknown[];

  /** Whether to return images in the response. */
  returnImages?: boolean;

  /** Whether to return related questions. */
  returnRelatedQuestions?: boolean;

  /** Restrict results to a time interval: "month", "week", "day", or "hour". */
  searchRecencyFilter?: string;

  /** Top-k sampling parameter between 1 and 2048. */
  topK?: number;

  /** Presence penalty between -2 and 2. */
  presencePenalty?: number;

  /** Frequency penalty (must be > 0). */
  frequencyPenalty?: number;

  /**
   * API key for Perplexity. Defaults to the `PERPLEXITY_API_KEY`
   * environment variable.
   */
  apiKey?: string;

  /** Whether to stream the response. */
  streaming?: boolean;

  /** Request timeout in milliseconds. */
  timeout?: number;

  /** Search mode: "academic" prioritizes scholarly sources. */
  searchMode?: "academic" | "web";

  /** Reasoning effort for deep-research models (sonar-deep-research only). */
  reasoningEffort?: "low" | "medium" | "high";

  /** Only include content published after this date. */
  searchAfterDateFilter?: string;

  /** Only include content published before this date. */
  searchBeforeDateFilter?: string;

  /** Only include content last updated after this date. */
  lastUpdatedAfterFilter?: string;

  /** Only include content last updated before this date. */
  lastUpdatedBeforeFilter?: string;

  /** Disable web search entirely; use only training data. */
  disableSearch?: boolean;

  /** Enable a classifier that decides if web search is needed. */
  enableSearchClassifier?: boolean;

  /** Configuration for web search behaviour. */
  webSearchOptions?: WebSearchOptions;

  /**
   * Whether to use the Perplexity Agent API (Responses-compatible) instead of Chat Completions.
   *
   * If `undefined` (default), inferred from the request payload: `true` when the request
   * uses a built-in Perplexity tool (`web_search`, `fetch_url`, `finance_search`, `people_search`)
   * or any Responses-only field (`previousResponseId`, `instructions`, `input`, `include`).
   * `false` otherwise.
   *
   * Maps to `client.responses.create()` → `POST /v1/agent` (alias: `/v1/responses`).
   */
  useResponsesApi?: boolean;
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

  /**
   * Tools to expose to the model. May include OpenAI-style function tools or
   * Perplexity built-in tools (e.g. `{ type: "web_search" }`). Passing any
   * built-in tool routes the request to the Agent API automatically.
   */
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<Record<string, any>>;

  /**
   * Continue a prior Agent API turn. Setting this routes to the Agent API
   * automatically.
   */
  previousResponseId?: string;

  /**
   * System-style instructions for the Agent API. Setting this routes to the
   * Agent API automatically.
   */
  instructions?: string;

  /**
   * Native Agent API input. When provided it replaces `messages`. Setting this
   * routes to the Agent API automatically.
   */
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  input?: unknown;

  /**
   * Additional Agent API response fields to include. Setting this routes to
   * the Agent API automatically.
   */
  include?: string[];
}

function _isBuiltinTool(tool: Record<string, unknown>): boolean {
  return typeof tool.type === "string" && tool.type !== "function";
}

function _useResponsesApi(payload: Record<string, unknown>): boolean {
  const tools = payload.tools as Array<Record<string, unknown>> | undefined;
  const usesBuiltin = Array.isArray(tools) && tools.some(_isBuiltinTool);
  const responsesOnly = [
    "previous_response_id",
    "instructions",
    "input",
    "include",
  ];
  const hasResponsesOnly = responsesOnly.some((k) => k in payload);
  return Boolean(usesBuiltin || hasResponsesOnly);
}

/**
 * Map a Perplexity Agent API (Responses-compatible) response to a `ChatResult`.
 */
export function convertResponsesToChatResult(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  response: Record<string, any>
): ChatResult {
  const outputItems: Array<Record<string, unknown>> = Array.isArray(
    response.output
  )
    ? (response.output as Array<Record<string, unknown>>)
    : [];

  let text: string = "";
  if (typeof response.output_text === "string") {
    text = response.output_text;
  } else {
    const parts: string[] = [];
    for (const item of outputItems) {
      const content = item.content as
        | Array<Record<string, unknown>>
        | undefined;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block.text === "string") {
            parts.push(block.text);
          }
        }
      }
    }
    text = parts.join("");
  }

  const toolCalls: ToolCall[] = [];
  for (const item of outputItems) {
    if (item.type === "function_call") {
      let parsedArgs: Record<string, unknown> = {};
      const raw = item.arguments;
      if (typeof raw === "string" && raw.length > 0) {
        try {
          parsedArgs = JSON.parse(raw);
        } catch {
          parsedArgs = { __raw: raw };
        }
      } else if (raw && typeof raw === "object") {
        parsedArgs = raw as Record<string, unknown>;
      }
      toolCalls.push({
        id: (item.call_id as string) ?? (item.id as string) ?? "",
        name: (item.name as string) ?? "",
        args: parsedArgs,
        type: "tool_call",
      });
    }
  }

  const responseMetadata: Record<string, unknown> = {
    id: response.id,
    model: response.model,
    status: response.status,
    object: response.object,
  };
  for (const key of [
    "citations",
    "images",
    "related_questions",
    "search_results",
  ] as const) {
    if (response[key] !== undefined) {
      responseMetadata[key] = response[key];
    }
  }

  let usageMetadata: UsageMetadata | undefined;
  if (response.usage) {
    const usage = response.usage as Record<string, unknown>;
    usageMetadata = {
      input_tokens: (usage.input_tokens as number) ?? 0,
      output_tokens: (usage.output_tokens as number) ?? 0,
      total_tokens: (usage.total_tokens as number) ?? 0,
    };
  }

  const additionalKwargs: Record<string, unknown> = {
    responses_output: outputItems,
  };

  const message = new AIMessage({
    content: text,
    tool_calls: toolCalls,
    additional_kwargs: additionalKwargs,
    response_metadata: responseMetadata,
    usage_metadata: usageMetadata,
  });

  return {
    generations: [{ text, message }],
    llmOutput: {
      tokenUsage: usageMetadata
        ? {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          }
        : {},
    },
  };
}

/**
 * Map a single Perplexity Agent API streaming event to a `ChatGenerationChunk`.
 * Returns `null` for events that do not produce a chunk.
 */
export function convertResponsesEventToChunk(
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  event: Record<string, any>
): ChatGenerationChunk | null {
  if (!event || typeof event !== "object") return null;
  if (event.type === "response.output_text.delta") {
    const delta: string = typeof event.delta === "string" ? event.delta : "";
    return new ChatGenerationChunk({
      text: delta,
      message: new AIMessageChunk({ content: delta }),
    });
  }
  if (event.type === "response.completed") {
    const usage = event.response?.usage as Record<string, unknown> | undefined;
    let usageMetadata: UsageMetadata | undefined;
    if (usage) {
      usageMetadata = {
        input_tokens: (usage.input_tokens as number) ?? 0,
        output_tokens: (usage.output_tokens as number) ?? 0,
        total_tokens: (usage.total_tokens as number) ?? 0,
      };
    }
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        usage_metadata: usageMetadata,
        response_metadata: event.response
          ? {
              id: event.response.id,
              model: event.response.model,
              status: event.response.status,
              object: event.response.object,
            }
          : {},
      }),
    });
  }
  if (event.type === "response.error") {
    throw new Error(
      typeof event.message === "string" ? event.message : "Responses API error"
    );
  }
  return null;
}

/**
 * Wrapper around Perplexity large language models that use the Chat endpoint.
 *
 * @example
 * ```typescript
 * import { ChatPerplexity } from "@langchain/perplexity";
 *
 * const model = new ChatPerplexity({
 *   model: "sonar",
 *   apiKey: process.env.PERPLEXITY_API_KEY,
 * });
 *
 * const result = await model.invoke([
 *   ["human", "What is the weather in San Francisco?"],
 * ]);
 * console.log(result.content);
 * ```
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

  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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

  lastUpdatedAfterFilter?: string;

  lastUpdatedBeforeFilter?: string;

  disableSearch?: boolean;

  enableSearchClassifier?: boolean;

  webSearchOptions?: WebSearchOptions;

  useResponsesApi?: boolean;

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
    this.lastUpdatedAfterFilter = fields?.lastUpdatedAfterFilter;
    this.lastUpdatedBeforeFilter = fields?.lastUpdatedBeforeFilter;
    this.disableSearch = fields?.disableSearch;
    this.enableSearchClassifier = fields?.enableSearchClassifier;
    this.webSearchOptions = fields?.webSearchOptions;
    this.useResponsesApi = fields?.useResponsesApi;

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
   * Build the parameters sent to the Perplexity API.
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
      last_updated_after_filter: this.lastUpdatedAfterFilter,
      last_updated_before_filter: this.lastUpdatedBeforeFilter,
      disable_search: this.disableSearch,
      enable_search_classifier: this.enableSearchClassifier,
      web_search_options: this.webSearchOptions as Record<string, unknown>,
    };
  }

  /**
   * Map a LangChain `BaseMessage` to a Perplexity API role/content pair.
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

  /**
   * Decide whether to route a payload through the Agent API (Responses) or
   * Chat Completions. Honors the explicit `useResponsesApi` setting when one
   * was provided; otherwise auto-detects from the payload shape.
   */
  protected _useResponsesApi(payload: Record<string, unknown>): boolean {
    if (typeof this.useResponsesApi === "boolean") return this.useResponsesApi;
    return _useResponsesApi(payload);
  }

  /**
   * Translate a Chat-Completions-shaped payload into the Agent API
   * (Responses) shape. Non-equivalent Perplexity knobs are stashed under
   * `extra_body` so they still reach the server.
   *
   * Per the Perplexity OpenAI-compatible docs, the Agent API alias accepts
   * `max_tokens`, so it is passed through unchanged.
   * https://docs.perplexity.ai/docs/agent-api/openai-compatibility
   */
  protected _toResponsesPayload(
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const passthrough = new Set([
      "model",
      "stream",
      "temperature",
      "max_tokens",
      "top_p",
      "tools",
      "tool_choice",
      "instructions",
      "previous_response_id",
      "include",
      "response_format",
    ]);
    const extraBody: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined) continue;
      if (key === "messages") {
        if (!("input" in payload)) {
          out.input = value;
        }
        continue;
      }
      if (key === "input") {
        out.input = value;
        continue;
      }
      if (passthrough.has(key)) {
        out[key] = value;
        continue;
      }
      extraBody[key] = value;
    }
    if (Object.keys(extraBody).length > 0) {
      out.extra_body = extraBody;
    }
    return out;
  }

  /**
   * Collect Agent-API-specific knobs from call options.
   */
  private _responsesOptions(
    options?: this["ParsedCallOptions"]
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (options?.tools !== undefined) out.tools = options.tools;
    if (options?.previousResponseId !== undefined)
      out.previous_response_id = options.previousResponseId;
    if (options?.instructions !== undefined)
      out.instructions = options.instructions;
    if (options?.input !== undefined) out.input = options.input;
    if (options?.include !== undefined) out.include = options.include;
    return out;
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

    const basePayload: Record<string, unknown> = {
      messages: messagesList,
      ...this.invocationParams(options),
      ...this._responsesOptions(options),
    };
    const route = this._useResponsesApi(basePayload);

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

    if (route) {
      const responsesPayload = this._toResponsesPayload({
        ...basePayload,
        stream: false,
      });
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.client as any).responses.create(
        responsesPayload
      );
      return convertResponsesToChatResult(response);
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
          // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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

    const basePayload: Record<string, unknown> = {
      messages: messagesList,
      ...this.invocationParams(options),
      ...this._responsesOptions(options),
    };

    if (this._useResponsesApi(basePayload)) {
      const responsesPayload = this._toResponsesPayload({
        ...basePayload,
        stream: true,
      });
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      const responsesStream = await (this.client as any).responses.create(
        responsesPayload
      );
      for await (const event of responsesStream as AsyncIterable<
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        Record<string, any>
      >) {
        const chunk = convertResponsesEventToChunk(event);
        if (chunk === null) continue;
        yield chunk;
        if (runManager && chunk.text) {
          await runManager.handleLLMNewToken(chunk.text);
        }
      }
      return;
    }

    const stream = await this.client.chat.completions.create({
      messages: messagesList,
      ...this.invocationParams(options),
      stream: true,
    });

    let firstChunk = true;
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const { delta } = choice;
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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

      if (runManager) {
        await runManager.handleLLMNewToken(delta.content);
      }
    }
  }

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
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
