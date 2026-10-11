import {
  BaseChatModel,
  type LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
} from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import { concat } from "@langchain/core/utils/stream";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { ModelProfile } from "@langchain/core/language_models/profile";
import PROFILES from "./profiles.js";
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { Runnable, RunnableLambda } from "@langchain/core/runnables";
import type { InteropZodType } from "@langchain/core/utils/types";
import { ApiClient } from "../clients/index.js";
import type {
  BaseChatGoogleParams,
  BaseChatGoogleCallOptions,
  GooglePlatformType,
  GenerateContentApiHandlerParams,
} from "./types.js";
import { ConfigurationError, MalformedOutputError } from "../utils/errors.js";
import { convertParamsToPlatformType } from "../converters/generate_content/params.js";
import { usageMetadataToTokenUsage } from "../utils/metadata.js";
import type { SerializableSchema } from "@langchain/core/utils/standard_schema";
import {
  assembleStructuredOutputPipeline,
  createContentParser,
  createFunctionCallingParser,
} from "@langchain/core/language_models/structured_output";
import { resolveLangSmithGatewayConfig } from "@langchain/core/utils/gateway";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  GoogleChatApiHandler,
  GenerateContentApiHandler,
} from "./handlers/index.js";

export type {
  BaseChatGoogleParams,
  BaseChatGoogleCallOptions,
  GooglePlatformType,
} from "./types.js";

function hasVertexCredentials(params: {
  credentials?: unknown;
  googleAuthOptions?: unknown;
}): boolean {
  return (
    typeof params.credentials !== "undefined" ||
    typeof params.googleAuthOptions !== "undefined" ||
    typeof getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS") !== "undefined"
  );
}

/**
 * Resolves LangSmith gateway routing for Google chat model params.
 *
 * The LangSmith gateway exposes direct paths for the Gemini Developer API and
 * Vertex AI. An explicit `endpoint` suppresses gateway routing.
 *
 * When `LANGSMITH_GATEWAY` is set, this rewrites `endpoint` to the gateway
 * host and lets the gateway key take precedence over the provider key (which
 * then rides as the `x-goog-api-key` header via the ApiClient). The default
 * `https` gateway host is written scheme-less (the URL builders prepend
 * `https://`); a non-`https` custom gateway keeps its scheme so it is not
 * forced to TLS.
 *
 * This function is pure: it never mutates `params`. It returns a new object
 * with the gateway overrides applied when routing is active, or an unchanged
 * shallow copy otherwise.
 *
 * @returns a new params object with gateway routing applied when applicable.
 */
export function applyGeminiGatewayParams<TParams extends object>(
  params: TParams
): TParams & {
  apiKey?: string;
  endpoint?: string;
  platformType?: GooglePlatformType;
} {
  const p = params as {
    apiKey?: string;
    endpoint?: string;
    platformType?: GooglePlatformType;
    vertexai?: boolean;
    credentials?: unknown;
    googleAuthOptions?: unknown;
  };
  if (typeof p.endpoint !== "undefined") {
    return { ...params };
  }
  const platform =
    convertParamsToPlatformType(p) ?? (hasVertexCredentials(p) ? "gcp" : "gai");
  const gatewayConfig = resolveLangSmithGatewayConfig({
    providerPath: platform === "gcp" ? "vertex" : "gemini",
  });
  if (typeof gatewayConfig.baseURL === "undefined") {
    return { ...params };
  }

  // A provider key still wins over the gateway key.
  const gatewayUrl = new URL(gatewayConfig.baseURL);
  const path = gatewayUrl.pathname.replace(/\/+$/, "");
  // The URL builders compose `https://${endpoint}/${apiVersion}/...`. For the
  // default `https` gateway, keep the endpoint scheme-less (host + path) so the
  // builder's `https://` prefix produces the right URL. For a non-`https`
  // custom gateway (e.g. `http://localhost:8080`), keep the full scheme so the
  // builder does not force TLS; `buildUrlGemini` skips its prefix when the
  // endpoint already includes a scheme.
  const endpoint =
    gatewayUrl.protocol === "https:"
      ? `${gatewayUrl.host}${path}`
      : `${gatewayUrl.protocol}//${gatewayUrl.host}${path}`;
  return {
    ...params,
    apiKey: p.apiKey ?? gatewayConfig.apiKey,
    endpoint,
    platformType: platform,
  };
}

export function getPlatformType(
  platform: GooglePlatformType | undefined,
  hasApiKey: boolean
): GooglePlatformType {
  if (typeof platform !== "undefined") {
    return platform;
  } else if (hasApiKey) {
    return "gai";
  } else {
    return "gcp";
  }
}

export abstract class BaseChatGoogle<
  CallOptions extends BaseChatGoogleCallOptions = BaseChatGoogleCallOptions,
> extends BaseChatModel<CallOptions, AIMessageChunk> {
  model: string;

  streaming: boolean;

  disableStreaming: boolean;

  streamUsage: boolean = true;

  protected _platform?: GooglePlatformType;

  protected _endpoint?: string;

  protected _customHeaders?: Record<string, string>;

  protected _location?: string;

  protected _apiVersion?: string;

  protected apiClient: ApiClient;

  constructor(
    protected params: BaseChatGoogleParams & {
      credentials?: unknown;
      googleAuthOptions?: unknown;
    }
  ) {
    super(params);
    this._addVersion("@langchain/google", __PKG_VERSION__);

    if (!params.apiClient) {
      throw new ConfigurationError(
        "BaseChatGoogle requires an apiClient. This should be provided automatically by ChatGoogle constructors. If you're extending BaseChatGoogle directly, please provide an apiClient instance."
      );
    }
    this.apiClient = params.apiClient;

    this.model = params.model;
    this._platform = convertParamsToPlatformType(params);
    this._endpoint = params.endpoint;
    this._customHeaders = params.customHeaders;
    this._location = params.location;
    this._apiVersion = params.apiVersion;

    this.disableStreaming = params?.disableStreaming === true;
    this.streaming = params?.streaming === true;
    if (this.disableStreaming) this.streaming = false;
    // disable streaming in BaseChatModel if explicitly disabled
    if (params?.streaming === false) this.disableStreaming = true;

    this.streamUsage = params?.streamUsage ?? this.streamUsage;
    if (this.disableStreaming) this.streamUsage = false;
  }

  _llmType(): string {
    return "google";
  }

  protected get platformType(): GooglePlatformType | undefined {
    return this._platform;
  }

  protected get platform(): GooglePlatformType {
    return getPlatformType(this._platform, this.apiClient.hasApiKey());
  }

  protected get isVertexExpress(): boolean {
    return (
      this.platform === "gcp" &&
      this.apiClient.hasApiKey() &&
      !hasVertexCredentials(this.params)
    );
  }

  protected get apiVersion(): string {
    if (typeof this._apiVersion !== "undefined") {
      return this._apiVersion;
    } else if (this.platform === "gai") {
      return "v1beta";
    } else {
      return "v1";
    }
  }

  protected get location(): string {
    return this._location || "global";
  }

  protected get endpoint(): string {
    if (typeof this._endpoint !== "undefined") {
      return this._endpoint;
    } else if (this.platform === "gai") {
      return "generativelanguage.googleapis.com";
    } else if (this.isVertexExpress) {
      return "aiplatform.googleapis.com";
    } else if (this.location === "global") {
      // See https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#use_the_global_endpoint
      return "aiplatform.googleapis.com";
    } else if (!this.location.includes("-")) {
      return `aiplatform.${this.location}.rep.googleapis.com`;
    } else {
      return `${this.location}-aiplatform.googleapis.com`;
    }
  }

  protected get publisher(): string {
    return "google";
  }

  protected _apiHandler?: GoogleChatApiHandler;

  get apiHandler(): GoogleChatApiHandler {
    if (!this._apiHandler) {
      const handlerConfig = this.params.apiHandler ?? "generateContent";
      const handlerParams: GenerateContentApiHandlerParams = {
        ...this.params,
        model: this.model,
        platform: this.platform,
        endpoint: this.endpoint,
        location: this.location,
        apiVersion: this.apiVersion,
        isVertexExpress: this.isVertexExpress,
        publisher: this.publisher,
        streaming: this.streaming,
        streamUsage: this.streamUsage,
        customHeaders: this.params.customHeaders,
        apiClient: this.apiClient,
        caller: this.caller,
      };

      if (typeof handlerConfig === "function") {
        this._apiHandler = handlerConfig(handlerParams);
      } else if (handlerConfig === "generateContent") {
        this._apiHandler = new GenerateContentApiHandler(handlerParams);
      } else {
        throw new ConfigurationError(`Unknown apiHandler: ${handlerConfig}`);
      }
    }
    return this._apiHandler;
  }

  /**
   * Returns the model profile for this instance's model, describing its
   * capabilities and constraints (e.g. max tokens, input/output modalities,
   * tool calling support).
   *
   * @example
   * ```typescript
   * const model = new ChatGoogle({ model: "gemini-2.5-pro" });
   * const profile = model.profile;
   * console.log(profile.maxInputTokens); // 1048576
   * console.log(profile.imageInputs); // true
   * ```
   */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  async buildUrl(urlMethod?: string): Promise<string> {
    return this.apiHandler.buildUrl(urlMethod);
  }

  override invocationParams(
    options: this["ParsedCallOptions"]
  ): Record<string, unknown> {
    return this.apiHandler.invocationParams(options) as Record<string, unknown>;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: this.platform === "gcp" ? "google_vertexai" : "google_genai",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: options?.temperature ?? this.params.temperature,
      ls_max_tokens: options?.maxOutputTokens ?? this.params.maxOutputTokens,
      ls_stop:
        options?.stopSequences ?? options?.stop ?? this.params.stopSequences,
    };
  }

  getHeaders(options?: this["ParsedCallOptions"]): HeadersInit {
    return this.apiHandler.getHeaders(options);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = await this._streamResponseChunks(
        messages,
        options,
        runManager
      );
      let finalChunk: ChatGenerationChunk | null = null;
      for await (const chunk of stream) {
        finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
      }
      if (
        typeof finalChunk?.message?.content === "string" &&
        typeof (
          finalChunk?.message?.additional_kwargs
            ?.originalTextContentBlock as Record<string, unknown>
        )?.text === "string"
      ) {
        (
          finalChunk.message.additional_kwargs
            .originalTextContentBlock as Record<string, unknown>
        ).text = finalChunk.message.content;
      }
      const usageMetadata = (finalChunk?.message as AIMessageChunk | undefined)
        ?.usage_metadata;
      return {
        generations: finalChunk ? [finalChunk] : [],
        ...(usageMetadata
          ? {
              llmOutput: {
                tokenUsage: usageMetadataToTokenUsage(usageMetadata),
                usageMetadata,
              },
            }
          : {}),
      };
    }

    return this.apiHandler.generate(messages, options, runManager);
  }

  override async *_streamChatModelEvents(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent> {
    yield* this.apiHandler.streamChatModelEvents(
      messages,
      options,
      runManager
    );
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    yield* this.apiHandler.streamResponseChunks(messages, options, runManager);
  }

  /**
   * Bind tool-like objects to this chat model.
   *
   * @param tools A list of tool definitions to bind to this chat model.
   * Can be a structured tool, an OpenAI formatted tool, or a Gemini function declaration.
   * @param kwargs Any additional parameters to bind.
   */
  bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseMessage[], AIMessageChunk, CallOptions> {
    return this.withConfig({
      ...kwargs,
      tools,
    } as Partial<CallOptions>);
  }

  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
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
      | SerializableSchema<RunOutput>
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
      | SerializableSchema<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  /**
   * Get structured output from the model based on a schema.
   *
   * This method supports two modes:
   * - `jsonMode`: Uses `responseSchema` to get JSON responses directly (preferred for structured outputs)
   * - `functionCalling`: Uses function calling with tools (default, for compatibility)
   *
   * @param outputSchema - The schema to use for structured output (Zod schema or JSON Schema)
   * @param config - Configuration options including method and whether to include raw response
   * @returns A Runnable that returns the parsed structured output
   */
  withStructuredOutput<
    // oxlint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      | SerializableSchema<RunOutput>
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    let llm: Runnable<BaseMessage[], AIMessageChunk, CallOptions>;
    let outputParser: Runnable<BaseMessage, RunOutput>;

    const { schema, name, includeRaw } = {
      ...config,
      schema: outputSchema,
    };
    let method = config?.method ?? "functionCalling";

    if (method === "jsonMode") {
      console.warn(
        `"jsonMode" is not supported for Google models. Falling back to "jsonSchema".`
      );
      method = "jsonSchema";
    }

    if (method === "jsonSchema") {
      // Use JSON mode with responseSchema
      llm = this.withConfig({
        responseSchema: schema,
      } as Partial<CallOptions>);

      outputParser = RunnableLambda.from<BaseMessage, RunOutput>(
        async (input: BaseMessage): Promise<RunOutput> => {
          if (
            !AIMessage.isInstance(input) &&
            !AIMessageChunk.isInstance(input)
          ) {
            throw new MalformedOutputError({
              message: "Input is not an AIMessage or AIMessageChunk.",
            });
          }

          if (!input.text) {
            throw new MalformedOutputError({
              message:
                "No content found in response. Cannot parse structured output.",
            });
          }

          // Parse JSON and validate with schema
          const parser = createContentParser(schema);
          return await parser.parse(input.text);
        }
      );
    } else if (method === "functionCalling") {
      const { tools, toolChoice, functionName } =
        this.apiHandler.formatStructuredOutputTool(schema, { name });

      llm = this.bindTools(tools).withConfig({
        tool_choice: toolChoice,
      } as Partial<CallOptions>);

      outputParser = createFunctionCallingParser(schema, functionName);
    } else {
      throw new ConfigurationError(
        `Unrecognized structured output method '${method}'. Expected 'functionCalling' or 'jsonSchema'`
      );
    }

    return assembleStructuredOutputPipeline(
      llm,
      outputParser,
      includeRaw,
      includeRaw
        ? "ChatGoogleStructuredOutputRunnable"
        : "ChatGoogleStructuredOutput"
    );
  }
}
export {
  combineGoogleChatModelFields,
  getGoogleChatModelParams,
} from "../converters/generate_content/params.js";
