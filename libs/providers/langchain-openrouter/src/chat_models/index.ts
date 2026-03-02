import {
  BaseChatModel,
  type BindToolsInput,
  type LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import type { ModelProfile } from "@langchain/core/language_models/profile";
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  type InteropZodType,
  isInteropZodSchema,
  getSchemaDescription,
} from "@langchain/core/utils/types";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { EventSourceParserStream } from "eventsource-parser/stream";

import type {
  ChatOpenRouterParams,
  ChatOpenRouterCallOptions,
} from "./types.js";
import type { OpenAI as OpenAIClient } from "openai";
import type { OpenRouter } from "../api-types.js";

/**
 * Full request body sent to the OpenRouter `/chat/completions` endpoint.
 *
 * Extends the base generation params with OpenRouter-specific sampling
 * knobs (`top_k`, `min_p`, etc.) and features (`prediction`, `transforms`)
 * that aren't part of the standard OpenAI spec.
 */
type OpenRouterRequestBody = Omit<
  OpenRouter.ChatGenerationParams,
  "messages"
> & {
  messages: OpenAIClient.Chat.Completions.ChatCompletionMessageParam[];
  top_k?: number | null;
  repetition_penalty?: number | null;
  min_p?: number | null;
  top_a?: number | null;
  prediction?: { type: "content"; content: string };
  transforms?: string[];
};
import {
  convertMessagesToOpenRouterParams,
  convertOpenRouterResponseToBaseMessage,
  convertOpenRouterDeltaToBaseMessageChunk,
  convertUsageMetadata,
} from "../converters/messages.js";
import {
  convertToolsToOpenRouter,
  formatToolChoice,
} from "../converters/tools.js";
import { OpenRouterError, OpenRouterAuthError } from "../utils/errors.js";
import { resolveOpenRouterStructuredOutputMethod } from "../utils/structured_output.js";
import { OpenRouterJsonParseStream } from "../utils/stream.js";
import PROFILES from "../profiles.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * OpenRouter chat model integration.
 *
 * Talks directly to the OpenRouter REST API via `fetch` (no SDK dependency)
 * and supports tool calling, structured output, and streaming. Any model
 * available on OpenRouter can be used by passing its identifier (e.g.
 * `"anthropic/claude-4-sonnet"`) as the `model` param.
 */
export class ChatOpenRouter extends BaseChatModel<
  ChatOpenRouterCallOptions,
  AIMessageChunk
> {
  static lc_name() {
    return "ChatOpenRouter";
  }

  lc_serializable = true;

  /** Maps secret fields to the environment variable they can be loaded from. */
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "OPENROUTER_API_KEY",
    };
  }

  /** Allows serialized JSON to use `modelName` as an alias for `model`. */
  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
  }

  /** Fields that may be overridden per-call via `.bind()` / `.withConfig()`. */
  get callKeys(): string[] {
    return [
      ...super.callKeys,
      "tools",
      "tool_choice",
      "response_format",
      "seed",
      "strict",
      "temperature",
      "maxTokens",
      "topP",
      "topK",
      "frequencyPenalty",
      "presencePenalty",
      "repetitionPenalty",
      "minP",
      "topA",
      "stop",
      "logitBias",
      "topLogprobs",
      "user",
      "transforms",
      "models",
      "route",
      "provider",
      "plugins",
      "prediction",
    ];
  }

  /** Model identifier, e.g. `"anthropic/claude-4-sonnet"`. */
  model: string;

  /** OpenRouter API key. Falls back to the `OPENROUTER_API_KEY` env var. */
  apiKey: string;

  /** Base URL for the API. Defaults to `"https://openrouter.ai/api/v1"`. */
  baseURL: string;

  /** Sampling temperature (0–2). */
  temperature?: number;

  /** Maximum number of tokens to generate. */
  maxTokens?: number;

  /** Nucleus sampling cutoff probability. */
  topP?: number;

  /** Top-K sampling: only consider the K most likely tokens. */
  topK?: number;

  /** Additive penalty based on how often a token has appeared so far (−2 to 2). */
  frequencyPenalty?: number;

  /** Additive penalty based on whether a token has appeared at all (−2 to 2). */
  presencePenalty?: number;

  /** Multiplicative penalty applied to repeated token logits (0 to 2). */
  repetitionPenalty?: number;

  /** Minimum probability threshold for token sampling. */
  minP?: number;

  /** Top-A sampling threshold. */
  topA?: number;

  /** Random seed for deterministic generation. */
  seed?: number;

  /** Stop sequences that halt generation. */
  stop?: string[];

  /** Token-level biases to apply during sampling. */
  logitBias?: Record<string, number>;

  /** Number of most-likely log-probabilities to return per token. */
  topLogprobs?: number;

  /** Stable identifier for end-users, used for abuse detection. */
  user?: string;

  /** OpenRouter-specific transformations to apply to the request. */
  transforms?: string[];

  /** OpenRouter-specific list of models for routing. */
  models?: string[];

  /** OpenRouter-specific routing strategy. */
  route?: "fallback";

  /** OpenRouter-specific provider preferences and ordering. */
  provider?: OpenRouter.ProviderPreferences;

  /** OpenRouter plugins to enable (e.g. web search). */
  plugins?: ChatOpenRouterParams["plugins"];

  /**
   * Application URL for OpenRouter attribution. Maps to `HTTP-Referer` header.
   *
   * See https://openrouter.ai/docs/app-attribution for details.
   */
  siteUrl: string;

  /**
   * Application title for OpenRouter attribution. Maps to `X-Title` header.
   *
   * See https://openrouter.ai/docs/app-attribution for details.
   */
  siteName: string;

  /** Extra params passed through to the API body. */
  modelKwargs?: Record<string, unknown>;

  /** Whether to include token usage in streaming chunks. Defaults to `true`. */
  streamUsage: boolean;

  constructor(model: string, fields?: Omit<ChatOpenRouterParams, "model">);
  constructor(fields: ChatOpenRouterParams);
  constructor(
    modelOrFields: string | ChatOpenRouterParams,
    fieldsArg?: Omit<ChatOpenRouterParams, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(fieldsArg ?? {}), model: modelOrFields }
        : modelOrFields;
    super(fields);
    this._addVersion("@langchain/openrouter", __PKG_VERSION__);
    const apiKey =
      fields.apiKey ?? getEnvironmentVariable("OPENROUTER_API_KEY");
    if (!apiKey) {
      throw new OpenRouterAuthError(
        "OpenRouter API key is required. Get one at https://openrouter.ai/keys and set it via the `apiKey` parameter or the OPENROUTER_API_KEY environment variable."
      );
    }
    this.apiKey = apiKey;
    if (!fields.model) {
      throw new Error(
        'ChatOpenRouter requires a `model` parameter, e.g. "openai/gpt-4o-mini".'
      );
    }
    this.model = fields.model;
    this.baseURL = fields.baseURL ?? DEFAULT_BASE_URL;
    this.temperature = fields.temperature;
    this.maxTokens = fields.maxTokens;
    this.topP = fields.topP;
    this.topK = fields.topK;
    this.frequencyPenalty = fields.frequencyPenalty;
    this.presencePenalty = fields.presencePenalty;
    this.repetitionPenalty = fields.repetitionPenalty;
    this.minP = fields.minP;
    this.topA = fields.topA;
    this.seed = fields.seed;
    this.stop = fields.stop;
    this.logitBias = fields.logitBias;
    this.topLogprobs = fields.topLogprobs;
    this.user = fields.user;
    this.transforms = fields.transforms;
    this.models = fields.models;
    this.route = fields.route;
    this.provider = fields.provider;
    this.plugins = fields.plugins;
    this.siteUrl = fields.siteUrl ?? "https://docs.langchain.com/oss";
    this.siteName = fields.siteName ?? "langchain";
    this.modelKwargs = fields.modelKwargs;
    this.streamUsage = fields.streamUsage ?? true;
  }

  _llmType(): string {
    return "openrouter";
  }

  /** Static capability profile (context size, tool support, etc.) for the current model. */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  /** Builds auth + content-type headers, plus optional site attribution headers. */
  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": this.siteUrl,
      "X-Title": this.siteName,
    };
  }

  /** Returns the full chat-completions endpoint URL. */
  private buildUrl(): string {
    return `${this.baseURL}/chat/completions`;
  }

  /**
   * Merges constructor-level defaults with per-call overrides into the
   * API request body (everything except `messages`, which is added later).
   */
  override invocationParams(
    options: this["ParsedCallOptions"]
  ): Omit<OpenRouterRequestBody, "messages"> {
    const tools = options.tools
      ? convertToolsToOpenRouter(options.tools, { strict: options.strict })
      : undefined;
    const toolChoice = formatToolChoice(options.tool_choice);

    return {
      model: this.model,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? this.maxTokens,
      top_p: options.topP ?? this.topP,
      top_k: options.topK ?? this.topK,
      frequency_penalty: options.frequencyPenalty ?? this.frequencyPenalty,
      presence_penalty: options.presencePenalty ?? this.presencePenalty,
      repetition_penalty: options.repetitionPenalty ?? this.repetitionPenalty,
      min_p: options.minP ?? this.minP,
      top_a: options.topA ?? this.topA,
      seed: options.seed ?? this.seed,
      stop: options.stop ?? this.stop,
      logit_bias: options.logitBias ?? this.logitBias,
      top_logprobs: options.topLogprobs ?? this.topLogprobs,
      user: options.user ?? this.user,
      tools,
      tool_choice: toolChoice,
      response_format: options.response_format,
      ...(options.prediction ? { prediction: options.prediction } : {}),
      transforms: options.transforms ?? this.transforms,
      models: options.models ?? this.models,
      route: options.route ?? this.route,
      provider: options.provider ?? this.provider,
      plugins: options.plugins ?? this.plugins,
      ...this.modelKwargs,
    };
  }

  /** Returns metadata for LangSmith tracing (provider, model name, temperature, etc.). */
  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "openrouter",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  /**
   * Non-streaming generation. Sends a single request and returns the
   * complete response with the generated message and token usage.
   */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const body: OpenRouterRequestBody = {
      ...this.invocationParams(options),
      messages: convertMessagesToOpenRouterParams(messages, this.model),
      stream: false,
    };

    const response = await fetch(this.buildUrl(), {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      throw await OpenRouterError.fromResponse(response);
    }

    const data: OpenRouter.ChatResponse = await response.json();
    const choice = data.choices[0];

    if (!choice) {
      throw new OpenRouterError("No choices returned in response.");
    }

    const message = convertOpenRouterResponseToBaseMessage(choice, data);
    if (AIMessage.isInstance(message)) {
      message.usage_metadata = convertUsageMetadata(data.usage);
    }

    const text = typeof message.content === "string" ? message.content : "";

    await runManager?.handleLLMNewToken(text);

    return {
      generations: [
        {
          text,
          message,
          generationInfo: {
            finish_reason: choice.finish_reason,
          },
        },
      ],
      llmOutput: { tokenUsage: data.usage },
    };
  }

  /**
   * Streaming generation. Opens an SSE connection and yields one
   * `ChatGenerationChunk` per delta received from the API. The stream
   * pipeline is: raw bytes -> text -> SSE events -> JSON-parsed deltas.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const body: OpenRouterRequestBody = {
      ...this.invocationParams(options),
      messages: convertMessagesToOpenRouterParams(messages, this.model),
      stream: true,
    };

    const response = await fetch(this.buildUrl(), {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      throw await OpenRouterError.fromResponse(response);
    }

    if (!response.body) {
      return;
    }

    const stream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeThrough(new OpenRouterJsonParseStream());

    const reader = stream.getReader();
    let defaultRole: string | undefined;

    try {
      while (true) {
        const { done, value: data } = await reader.read();
        if (done) break;
        if (!data) continue;

        const choice = data.choices?.[0];
        if (!choice?.delta) continue;

        const chunk = convertOpenRouterDeltaToBaseMessageChunk(
          choice.delta,
          data,
          defaultRole
        );
        defaultRole = choice.delta.role ?? defaultRole;

        if (
          data.usage &&
          this.streamUsage &&
          AIMessageChunk.isInstance(chunk)
        ) {
          chunk.usage_metadata = convertUsageMetadata(data.usage);
        }

        const text = typeof chunk.content === "string" ? chunk.content : "";

        const generationChunk = new ChatGenerationChunk({
          message: chunk,
          text,
          generationInfo: {
            ...(choice.finish_reason
              ? { finish_reason: choice.finish_reason }
              : {}),
          },
        });

        yield generationChunk;
        await runManager?.handleLLMNewToken(
          text,
          undefined,
          undefined,
          undefined,
          { chunk: generationChunk }
        );
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Returns a new Runnable with the given tools bound into every call.
   * Equivalent to `.withConfig({ tools, ...kwargs })`.
   */
  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatOpenRouterCallOptions>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    ChatOpenRouterCallOptions
  > {
    return this.withConfig({
      ...kwargs,
      tools,
    } as Partial<ChatOpenRouterCallOptions>);
  }

  /**
   * Returns a Runnable that forces the model to produce output conforming
   * to `outputSchema` (a Zod schema or plain JSON Schema object).
   *
   * The extraction strategy (JSON Schema response format, function calling,
   * or JSON mode) is chosen automatically based on model capabilities —
   * see {@link resolveOpenRouterStructuredOutputMethod}. You can override
   * this via `config.method`.
   *
   * When `config.includeRaw` is `true` the returned object contains both
   * the raw `BaseMessage` and the parsed output, with a fallback that
   * sets `parsed: null` if the parser throws.
   */
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
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    RunOutput extends Record<string, unknown> = Record<string, unknown>
  >(
    outputSchema: InteropZodType<RunOutput> | Record<string, unknown>,
    config?: StructuredOutputMethodOptions<boolean>
  ) {
    let llm: Runnable<BaseLanguageModelInput>;
    let outputParser: Runnable<AIMessageChunk, RunOutput>;

    const { schema, name, includeRaw } = {
      ...config,
      schema: outputSchema,
    };

    const method = resolveOpenRouterStructuredOutputMethod({
      model: this.model,
      method: config?.method,
      profile: this.profile,
      models: this.models,
      route: this.route,
    });

    const asJsonSchema = toJsonSchema(schema);

    if (method === "jsonSchema") {
      const schemaName = name ?? "extract";
      llm = this.withConfig({
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            description: getSchemaDescription(schema),
            schema: asJsonSchema,
            strict: config?.strict,
          },
        },
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: {
            title: schemaName,
            description: getSchemaDescription(schema),
            ...asJsonSchema,
          },
        },
      } as Partial<ChatOpenRouterCallOptions>);

      outputParser = isInteropZodSchema(schema)
        ? StructuredOutputParser.fromZodSchema(schema)
        : new JsonOutputParser<RunOutput>();
    } else if (method === "jsonMode") {
      llm = this.withConfig({
        response_format: { type: "json_object" },
        ls_structured_output_format: {
          kwargs: { method: "json_mode" },
          schema: { title: name ?? "extract", ...asJsonSchema },
        },
      } as Partial<ChatOpenRouterCallOptions>);

      outputParser = isInteropZodSchema(schema)
        ? StructuredOutputParser.fromZodSchema(schema)
        : new JsonOutputParser<RunOutput>();
    } else {
      let functionName = name ?? "extract";
      if ("name" in (schema as Record<string, unknown>)) {
        functionName = (schema as Record<string, unknown>).name as string;
      }

      llm = this.withConfig({
        tools: [
          {
            type: "function" as const,
            function: {
              name: functionName,
              description: getSchemaDescription(schema) ?? "",
              parameters: asJsonSchema,
            },
          },
        ],
        tool_choice: {
          type: "function" as const,
          function: { name: functionName },
        },
        ls_structured_output_format: {
          kwargs: { method: "function_calling" },
          schema: { title: functionName, ...asJsonSchema },
        },
        ...(config?.strict !== undefined ? { strict: config.strict } : {}),
      } as Partial<ChatOpenRouterCallOptions>);

      outputParser = isInteropZodSchema(schema)
        ? new JsonOutputKeyToolsParser({
            returnSingle: true,
            keyName: functionName,
            zodSchema: schema,
          })
        : new JsonOutputKeyToolsParser<RunOutput>({
            returnSingle: true,
            keyName: functionName,
          });
    }

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatOpenRouterStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
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
    >([{ raw: llm }, parsedWithFallback]).withConfig({
      runName: "ChatOpenRouterStructuredOutput",
    });
  }
}
