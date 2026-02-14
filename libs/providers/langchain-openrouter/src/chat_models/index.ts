import {
  BaseChatModel,
  type BindToolsInput,
  type LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  toJsonSchema,
  type JsonSchema7Type,
} from "@langchain/core/utils/json_schema";
import {
  type InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { EventSourceParserStream } from "eventsource-parser/stream";

import type {
  ChatOpenRouterInput,
  ChatOpenRouterCallOptions,
  OpenRouterRequestBody,
} from "./types.js";
import type { OpenRouter } from "../api-types.js";
import {
  convertMessagesToOpenRouterParams,
  convertOpenRouterResponseToAIMessage,
  convertOpenRouterDeltaToAIMessageChunk,
  convertUsageMetadata,
} from "../converters/messages.js";
import {
  convertToolsToOpenRouter,
  formatToolChoice,
} from "../converters/tools.js";
import { OpenRouterError } from "../utils/errors.js";
import { OpenRouterJsonParseStream } from "../utils/stream.js";

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

export class ChatOpenRouter extends BaseChatModel<
  ChatOpenRouterCallOptions,
  AIMessageChunk
> {
  static lc_name() {
    return "ChatOpenRouter";
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "OPENROUTER_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
  }

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

  model: string;

  apiKey: string;

  baseURL: string;

  temperature?: number;

  maxTokens?: number;

  topP?: number;

  topK?: number;

  frequencyPenalty?: number;

  presencePenalty?: number;

  repetitionPenalty?: number;

  minP?: number;

  topA?: number;

  seed?: number;

  stop?: string[];

  logitBias?: Record<string, number>;

  topLogprobs?: number;

  user?: string;

  transforms?: string[];

  models?: string[];

  route?: "fallback";

  provider?: OpenRouter.ProviderPreferences;

  plugins?: ChatOpenRouterInput["plugins"];

  siteUrl?: string;

  siteName?: string;

  modelKwargs?: Record<string, unknown>;

  streamUsage: boolean;

  constructor(fields: ChatOpenRouterInput) {
    super(fields);
    const apiKey =
      fields.apiKey ?? getEnvironmentVariable("OPENROUTER_API_KEY");
    if (!apiKey) {
      throw new Error(
        "OpenRouter API key is required. Set it via the `apiKey` parameter or the OPENROUTER_API_KEY environment variable."
      );
    }
    this.apiKey = apiKey;
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
    this.siteUrl = fields.siteUrl;
    this.siteName = fields.siteName;
    this.modelKwargs = fields.modelKwargs;
    this.streamUsage = fields.streamUsage ?? true;
  }

  _llmType(): string {
    return "openrouter";
  }

  // ---------------------------------------------------------------------------
  // Request building
  // ---------------------------------------------------------------------------

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(this.siteUrl ? { "HTTP-Referer": this.siteUrl } : {}),
      ...(this.siteName ? { "X-Title": this.siteName } : {}),
    };
  }

  private buildUrl(): string {
    return `${this.baseURL}/chat/completions`;
  }

  override invocationParams(
    options: this["ParsedCallOptions"]
  ): OpenRouterRequestBody {
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

  // ---------------------------------------------------------------------------
  // LangSmith tracing
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Non-streaming generation
  // ---------------------------------------------------------------------------

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const body: OpenRouterRequestBody = {
      ...this.invocationParams(options),
      messages: convertMessagesToOpenRouterParams(messages),
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

    const message = convertOpenRouterResponseToAIMessage(choice, data);
    message.usage_metadata = convertUsageMetadata(data.usage);

    const text =
      typeof message.content === "string" ? message.content : "";

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

  // ---------------------------------------------------------------------------
  // Streaming generation
  // ---------------------------------------------------------------------------

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const body: OpenRouterRequestBody = {
      ...this.invocationParams(options),
      messages: convertMessagesToOpenRouterParams(messages),
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

        const choice = data.choices?.[0];
        if (!choice?.delta) continue;

        const chunk = convertOpenRouterDeltaToAIMessageChunk(
          choice.delta,
          data,
          defaultRole
        );
        defaultRole = choice.delta.role ?? defaultRole;

        if (data.usage && this.streamUsage) {
          chunk.usage_metadata = convertUsageMetadata(data.usage);
        }

        const text =
          typeof chunk.content === "string" ? chunk.content : "";

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
        await runManager?.handleLLMNewToken(text);
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ---------------------------------------------------------------------------
  // Tool binding
  // ---------------------------------------------------------------------------

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatOpenRouterCallOptions>
  ): Runnable<BaseMessage[], AIMessageChunk, ChatOpenRouterCallOptions> {
    return this.withConfig({
      ...kwargs,
      tools,
    } as Partial<ChatOpenRouterCallOptions>);
  }

  // ---------------------------------------------------------------------------
  // Structured output
  // ---------------------------------------------------------------------------

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
        { raw: BaseMessage; parsed: RunOutput }
      >;

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

    const method = config?.method ?? "functionCalling";

    if (method === "jsonSchema") {
      const jsonSchemaParams = {
        name: name ?? "extract",
        description: isInteropZodSchema(schema)
          ? (toJsonSchema(schema) as JsonSchema7Type & { description?: string })
              .description
          : (schema as { description?: string }).description,
        schema,
        strict: config?.strict,
      };

      llm = this.withConfig({
        response_format: {
          type: "json_schema",
          json_schema: jsonSchemaParams,
        },
      } as Partial<ChatOpenRouterCallOptions>);

      if (isInteropZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else if (method === "jsonMode") {
      llm = this.withConfig({
        response_format: { type: "json_object" },
      } as Partial<ChatOpenRouterCallOptions>);

      if (isInteropZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      // functionCalling (default)
      let functionName = name ?? "extract";
      const asJsonSchema = toJsonSchema(schema);

      if (
        typeof (schema as Record<string, unknown>).name === "string" &&
        typeof (schema as Record<string, unknown>).parameters === "object"
      ) {
        functionName =
          ((schema as Record<string, unknown>).name as string) ?? functionName;
      }

      llm = this.withConfig({
        tools: [
          {
            type: "function" as const,
            function: {
              name: functionName,
              description:
                (asJsonSchema as { description?: string }).description ?? "",
              parameters: asJsonSchema,
            },
          },
        ],
        tool_choice: {
          type: "function" as const,
          function: { name: functionName },
        },
        ...(config?.strict !== undefined ? { strict: config.strict } : {}),
      } as Partial<ChatOpenRouterCallOptions>);

      if (isInteropZodSchema(schema)) {
        outputParser = new JsonOutputKeyToolsParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }
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
