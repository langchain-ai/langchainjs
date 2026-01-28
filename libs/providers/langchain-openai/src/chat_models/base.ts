import OpenAI, { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { type ChatGeneration } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  type LangSmithParams,
  type BaseChatModelParams,
  BaseChatModelCallOptions,
} from "@langchain/core/language_models/chat_models";
import {
  isOpenAITool as isOpenAIFunctionTool,
  type BaseFunctionCallOptions,
  type BaseLanguageModelInput,
  type FunctionDefinition,
  type StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { ModelProfile } from "@langchain/core/language_models/profile";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
import {
  getSchemaDescription,
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  type OpenAICallOptions,
  type OpenAIChatInput,
  type OpenAICoreRequestOptions,
  type ChatOpenAIResponseFormat,
  ResponseFormatConfiguration,
  OpenAIVerbosityParam,
  type OpenAIApiKey,
  OpenAICacheRetentionParam,
} from "../types.js";
import {
  type OpenAIEndpointConfig,
  getEndpoint,
  getHeadersWithUserAgent,
} from "../utils/azure.js";
import {
  type FunctionDef,
  formatFunctionDefinitions,
  OpenAIToolChoice,
  _convertToOpenAITool,
  ChatOpenAIToolType,
  convertResponsesCustomTool,
  isBuiltInTool,
  isCustomTool,
  hasProviderToolDefinition,
  ResponsesToolChoice,
} from "../utils/tools.js";
import {
  getStructuredOutputMethod,
  interopZodResponseFormat,
  _convertOpenAIResponsesUsageToLangChainUsage,
} from "../utils/output.js";
import { isReasoningModel, messageToOpenAIRole } from "../utils/misc.js";
import { wrapOpenAIClientError } from "../utils/client.js";
import PROFILES from "./profiles.js";

interface OpenAILLMOutput {
  tokenUsage: {
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
  };
}

export type { OpenAICallOptions, OpenAIChatInput };

export interface BaseChatOpenAICallOptions
  extends BaseChatModelCallOptions,
    BaseFunctionCallOptions {
  /**
   * Additional options to pass to the underlying axios request.
   */
  options?: OpenAICoreRequestOptions;

  /**
   * A list of tools that the model may use to generate responses.
   * Each tool can be a function, a built-in tool, or a custom tool definition.
   * If not provided, the model will not use any tools.
   */
  tools?: ChatOpenAIToolType[];

  /**
   * Specifies which tool the model should use to respond.
   * Can be an {@link OpenAIToolChoice} or a {@link ResponsesToolChoice}.
   * If not set, the model will decide which tool to use automatically.
   */
  // TODO: break OpenAIToolChoice and ResponsesToolChoice into options sub classes
  tool_choice?: OpenAIToolChoice | ResponsesToolChoice;

  /**
   * Adds a prompt index to prompts passed to the model to track
   * what prompt is being used for a given generation.
   */
  promptIndex?: number;

  /**
   * An object specifying the format that the model must output.
   */
  response_format?: ChatOpenAIResponseFormat;

  /**
   * When provided, the completions API will make a best effort to sample
   * deterministically, such that repeated requests with the same `seed`
   * and parameters should return the same result.
   */
  seed?: number;

  /**
   * Additional options to pass to streamed completions.
   * If provided, this takes precedence over "streamUsage" set at
   * initialization time.
   */
  stream_options?: OpenAIClient.Chat.ChatCompletionStreamOptions;

  /**
   * The model may choose to call multiple functions in a single turn. You can
   * set parallel_tool_calls to false which ensures only one tool is called at most.
   * [Learn more](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling)
   */
  parallel_tool_calls?: boolean;

  /**
   * If `true`, model output is guaranteed to exactly match the JSON Schema
   * provided in the tool definition. If `true`, the input schema will also be
   * validated according to
   * https://platform.openai.com/docs/guides/structured-outputs/supported-schemas.
   *
   * If `false`, input schema will not be validated and model output will not
   * be validated.
   *
   * If `undefined`, `strict` argument will not be passed to the model.
   */
  strict?: boolean;

  /**
   * Output types that you would like the model to generate for this request. Most
   * models are capable of generating text, which is the default:
   *
   * `["text"]`
   *
   * The `gpt-4o-audio-preview` model can also be used to
   * [generate audio](https://platform.openai.com/docs/guides/audio). To request that
   * this model generate both text and audio responses, you can use:
   *
   * `["text", "audio"]`
   */
  modalities?: Array<OpenAIClient.Chat.ChatCompletionModality>;

  /**
   * Parameters for audio output. Required when audio output is requested with
   * `modalities: ["audio"]`.
   * [Learn more](https://platform.openai.com/docs/guides/audio).
   */
  audio?: OpenAIClient.Chat.ChatCompletionAudioParam;

  /**
   * Static predicted output content, such as the content of a text file that is being regenerated.
   * [Learn more](https://platform.openai.com/docs/guides/latency-optimization#use-predicted-outputs).
   */
  prediction?: OpenAIClient.ChatCompletionPredictionContent;

  /**
   * Options for reasoning models.
   *
   * Note that some options, like reasoning summaries, are only available when using the responses
   * API. If these options are set, the responses API will be used to fulfill the request.
   *
   * These options will be ignored when not using a reasoning model.
   */
  reasoning?: OpenAIClient.Reasoning;

  /**
   * Service tier to use for this request. Can be "auto", "default", or "flex"
   * Specifies the service tier for prioritization and latency optimization.
   */
  service_tier?: OpenAIClient.Chat.ChatCompletionCreateParams["service_tier"];

  /**
   * Used by OpenAI to cache responses for similar requests to optimize your cache
   * hit rates. Replaces the `user` field.
   * [Learn more](https://platform.openai.com/docs/guides/prompt-caching).
   */
  promptCacheKey?: string;

  /**
   * Used by OpenAI to set cache retention time
   */
  promptCacheRetention?: OpenAICacheRetentionParam;

  /**
   * The verbosity of the model's response.
   */
  verbosity?: OpenAIVerbosityParam;
}

export interface BaseChatOpenAIFields
  extends Partial<OpenAIChatInput>,
    BaseChatModelParams {
  /**
   * Optional configuration options for the OpenAI client.
   */
  configuration?: ClientOptions;
}

/** @internal */
export abstract class BaseChatOpenAI<
    CallOptions extends BaseChatOpenAICallOptions,
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements Partial<OpenAIChatInput>
{
  temperature?: number;

  topP?: number;

  frequencyPenalty?: number;

  presencePenalty?: number;

  n?: number;

  logitBias?: Record<string, number>;

  model = "gpt-3.5-turbo";

  modelKwargs?: OpenAIChatInput["modelKwargs"];

  stop?: string[];

  stopSequences?: string[];

  user?: string;

  timeout?: number;

  streaming = false;

  streamUsage = true;

  maxTokens?: number;

  logprobs?: boolean;

  topLogprobs?: number;

  apiKey?: OpenAIApiKey;

  organization?: string;

  __includeRawResponse?: boolean;

  /** @internal */
  client: OpenAIClient;

  /** @internal */
  clientConfig: ClientOptions;

  /**
   * Whether the model supports the `strict` argument when passing in tools.
   * If `undefined` the `strict` argument will not be passed to OpenAI.
   */
  supportsStrictToolCalling?: boolean;

  audio?: OpenAIClient.Chat.ChatCompletionAudioParam;

  modalities?: Array<OpenAIClient.Chat.ChatCompletionModality>;

  reasoning?: OpenAIClient.Reasoning;

  /**
   * Must be set to `true` in tenancies with Zero Data Retention. Setting to `true` will disable
   * output storage in the Responses API, but this DOES NOT enable Zero Data Retention in your
   * OpenAI organization or project. This must be configured directly with OpenAI.
   *
   * See:
   * https://platform.openai.com/docs/guides/your-data
   * https://platform.openai.com/docs/api-reference/responses/create#responses-create-store
   *
   * @default false
   */
  zdrEnabled?: boolean | undefined;

  /**
   * Service tier to use for this request. Can be "auto", "default", or "flex" or "priority".
   * Specifies the service tier for prioritization and latency optimization.
   */
  service_tier?: OpenAIClient.Chat.ChatCompletionCreateParams["service_tier"];

  /**
   * Used by OpenAI to cache responses for similar requests to optimize your cache
   * hit rates.
   * [Learn more](https://platform.openai.com/docs/guides/prompt-caching).
   */
  promptCacheKey: string;

  /**
   * Used by OpenAI to set cache retention time
   */
  promptCacheRetention?: OpenAICacheRetentionParam;

  /**
   * The verbosity of the model's response.
   */
  verbosity?: OpenAIVerbosityParam;

  protected defaultOptions: CallOptions;

  _llmType() {
    return "openai";
  }

  static lc_name() {
    return "ChatOpenAI";
  }

  get callKeys() {
    return [
      ...super.callKeys,
      "options",
      "function_call",
      "functions",
      "tools",
      "tool_choice",
      "promptIndex",
      "response_format",
      "seed",
      "reasoning",
      "service_tier",
    ];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "OPENAI_API_KEY",
      organization: "OPENAI_ORGANIZATION",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      apiKey: "openai_api_key",
      modelName: "model",
    };
  }

  get lc_serializable_keys(): string[] {
    return [
      "configuration",
      "logprobs",
      "topLogprobs",
      "prefixMessages",
      "supportsStrictToolCalling",
      "modalities",
      "audio",
      "temperature",
      "maxTokens",
      "topP",
      "frequencyPenalty",
      "presencePenalty",
      "n",
      "logitBias",
      "user",
      "streaming",
      "streamUsage",
      "model",
      "modelName",
      "modelKwargs",
      "stop",
      "stopSequences",
      "timeout",
      "apiKey",
      "cache",
      "maxConcurrency",
      "maxRetries",
      "verbose",
      "callbacks",
      "tags",
      "metadata",
      "disableStreaming",
      "zdrEnabled",
      "reasoning",
      "promptCacheKey",
      "promptCacheRetention",
      "verbosity",
    ];
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "openai",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  /** @ignore */
  _identifyingParams(): Omit<
    OpenAIClient.Chat.ChatCompletionCreateParams,
    "messages"
  > & {
    model_name: string;
  } & ClientOptions {
    return {
      model_name: this.model,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return this._identifyingParams();
  }

  constructor(fields?: BaseChatOpenAIFields) {
    super(fields ?? {});

    const configApiKey =
      typeof fields?.configuration?.apiKey === "string" ||
      typeof fields?.configuration?.apiKey === "function"
        ? fields?.configuration?.apiKey
        : undefined;
    this.apiKey =
      fields?.apiKey ??
      configApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");
    this.organization =
      fields?.configuration?.organization ??
      getEnvironmentVariable("OPENAI_ORGANIZATION");

    this.model = fields?.model ?? fields?.modelName ?? this.model;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.timeout = fields?.timeout;

    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.logprobs = fields?.logprobs;
    this.topLogprobs = fields?.topLogprobs;
    this.n = fields?.n ?? this.n;
    this.logitBias = fields?.logitBias;
    this.stop = fields?.stopSequences ?? fields?.stop;
    this.stopSequences = this.stop;
    this.user = fields?.user;
    this.__includeRawResponse = fields?.__includeRawResponse;
    this.audio = fields?.audio;
    this.modalities = fields?.modalities;
    this.reasoning = fields?.reasoning;
    this.maxTokens = fields?.maxCompletionTokens ?? fields?.maxTokens;
    this.promptCacheKey = fields?.promptCacheKey ?? this.promptCacheKey;
    this.promptCacheRetention =
      fields?.promptCacheRetention ?? this.promptCacheRetention;
    this.verbosity = fields?.verbosity ?? this.verbosity;

    this.disableStreaming = fields?.disableStreaming === true;
    this.streaming = fields?.streaming === true;
    if (this.disableStreaming) this.streaming = false;
    // disable streaming in BaseChatModel if explicitly disabled
    if (fields?.streaming === false) this.disableStreaming = true;

    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
    if (this.disableStreaming) this.streamUsage = false;

    this.clientConfig = {
      apiKey: this.apiKey,
      organization: this.organization,
      dangerouslyAllowBrowser: true,
      ...fields?.configuration,
    };

    // If `supportsStrictToolCalling` is explicitly set, use that value.
    // Else leave undefined so it's not passed to OpenAI.
    if (fields?.supportsStrictToolCalling !== undefined) {
      this.supportsStrictToolCalling = fields.supportsStrictToolCalling;
    }

    if (fields?.service_tier !== undefined) {
      this.service_tier = fields.service_tier;
    }

    this.zdrEnabled = fields?.zdrEnabled ?? false;
  }

  /**
   * Returns backwards compatible reasoning parameters from constructor params and call options
   * @internal
   */
  protected _getReasoningParams(
    options?: this["ParsedCallOptions"]
  ): OpenAIClient.Reasoning | undefined {
    if (!isReasoningModel(this.model)) {
      return;
    }

    // apply options in reverse order of importance -- newer options supersede older options
    let reasoning: OpenAIClient.Reasoning | undefined;
    if (this.reasoning !== undefined) {
      reasoning = {
        ...reasoning,
        ...this.reasoning,
      };
    }
    if (options?.reasoning !== undefined) {
      reasoning = {
        ...reasoning,
        ...options.reasoning,
      };
    }

    return reasoning;
  }

  /**
   * Returns an openai compatible response format from a set of options
   * @internal
   */
  protected _getResponseFormat(
    resFormat?: CallOptions["response_format"]
  ): ResponseFormatConfiguration | undefined {
    if (
      resFormat &&
      resFormat.type === "json_schema" &&
      resFormat.json_schema.schema &&
      isInteropZodSchema(resFormat.json_schema.schema)
    ) {
      return interopZodResponseFormat(
        resFormat.json_schema.schema,
        resFormat.json_schema.name,
        {
          description: resFormat.json_schema.description,
        }
      );
    }
    return resFormat as ResponseFormatConfiguration | undefined;
  }

  protected _combineCallOptions(
    additionalOptions?: this["ParsedCallOptions"]
  ): this["ParsedCallOptions"] {
    return {
      ...this.defaultOptions,
      ...(additionalOptions ?? {}),
    };
  }

  /** @internal */
  _getClientOptions(
    options: OpenAICoreRequestOptions | undefined
  ): OpenAICoreRequestOptions {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        baseURL: this.clientConfig.baseURL,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);
      const params = {
        ...this.clientConfig,
        baseURL: endpoint,
        timeout: this.timeout,
        maxRetries: 0,
      };
      if (!params.baseURL) {
        delete params.baseURL;
      }

      params.defaultHeaders = getHeadersWithUserAgent(params.defaultHeaders);

      this.client = new OpenAIClient(params);
    }
    const requestOptions = {
      ...this.clientConfig,
      ...options,
    } as OpenAICoreRequestOptions;
    return requestOptions;
  }

  // TODO: move to completions class
  protected _convertChatOpenAIToolToCompletionsTool(
    tool: ChatOpenAIToolType,
    fields?: { strict?: boolean }
  ): OpenAIClient.ChatCompletionTool {
    if (isCustomTool(tool)) {
      return convertResponsesCustomTool(tool.metadata.customTool);
    }
    if (isOpenAIFunctionTool(tool)) {
      if (fields?.strict !== undefined) {
        return {
          ...tool,
          function: {
            ...tool.function,
            strict: fields.strict,
          },
        };
      }

      return tool;
    }
    return _convertToOpenAITool(tool, fields);
  }

  override bindTools(
    tools: ChatOpenAIToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    let strict: boolean | undefined;
    if (kwargs?.strict !== undefined) {
      strict = kwargs.strict;
    } else if (this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }
    return this.withConfig({
      tools: tools.map((tool) => {
        // Built-in tools and custom tools pass through as-is
        if (isBuiltInTool(tool) || isCustomTool(tool)) {
          return tool;
        }
        // Tools with providerToolDefinition (e.g., localShell, shell, computerUse, applyPatch)
        // should use their provider-specific definition
        if (hasProviderToolDefinition(tool)) {
          return tool.extras.providerToolDefinition;
        }
        // Regular tools get converted to OpenAI function format
        return this._convertChatOpenAIToolToCompletionsTool(tool, { strict });
      }),
      ...kwargs,
    } as Partial<CallOptions>);
  }

  override async stream(input: BaseLanguageModelInput, options?: CallOptions) {
    return super.stream(
      input,
      this._combineCallOptions(options) as CallOptions
    );
  }

  override async invoke(input: BaseLanguageModelInput, options?: CallOptions) {
    return super.invoke(
      input,
      this._combineCallOptions(options) as CallOptions
    );
  }

  /** @ignore */
  _combineLLMOutput(...llmOutputs: OpenAILLMOutput[]): OpenAILLMOutput {
    return llmOutputs.reduce<{
      [key in keyof OpenAILLMOutput]: Required<OpenAILLMOutput[key]>;
    }>(
      (acc, llmOutput) => {
        if (llmOutput && llmOutput.tokenUsage) {
          acc.tokenUsage.completionTokens +=
            llmOutput.tokenUsage.completionTokens ?? 0;
          acc.tokenUsage.promptTokens += llmOutput.tokenUsage.promptTokens ?? 0;
          acc.tokenUsage.totalTokens += llmOutput.tokenUsage.totalTokens ?? 0;
        }
        return acc;
      },
      {
        tokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      }
    );
  }

  async getNumTokensFromMessages(messages: BaseMessage[]) {
    let totalCount = 0;
    let tokensPerMessage = 0;
    let tokensPerName = 0;

    // From: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
    if (this.model === "gpt-3.5-turbo-0301") {
      tokensPerMessage = 4;
      tokensPerName = -1;
    } else {
      tokensPerMessage = 3;
      tokensPerName = 1;
    }

    const countPerMessage = await Promise.all(
      messages.map(async (message) => {
        const [textCount, roleCount] = await Promise.all([
          this.getNumTokens(message.content),
          this.getNumTokens(messageToOpenAIRole(message)),
        ]);
        const nameCount =
          message.name !== undefined
            ? tokensPerName + (await this.getNumTokens(message.name))
            : 0;
        let count = textCount + tokensPerMessage + roleCount + nameCount;

        // From: https://github.com/hmarr/openai-chat-tokens/blob/main/src/index.ts messageTokenEstimate
        const openAIMessage = message;
        if (openAIMessage._getType() === "function") {
          count -= 2;
        }
        if (openAIMessage.additional_kwargs?.function_call) {
          count += 3;
        }
        if (openAIMessage?.additional_kwargs.function_call?.name) {
          count += await this.getNumTokens(
            openAIMessage.additional_kwargs.function_call?.name
          );
        }
        if (openAIMessage.additional_kwargs.function_call?.arguments) {
          try {
            count += await this.getNumTokens(
              // Remove newlines and spaces
              JSON.stringify(
                JSON.parse(
                  openAIMessage.additional_kwargs.function_call?.arguments
                )
              )
            );
          } catch (error) {
            console.error(
              "Error parsing function arguments",
              error,
              JSON.stringify(openAIMessage.additional_kwargs.function_call)
            );
            count += await this.getNumTokens(
              openAIMessage.additional_kwargs.function_call?.arguments
            );
          }
        }

        totalCount += count;
        return count;
      })
    );

    totalCount += 3; // every reply is primed with <|start|>assistant<|message|>

    return { totalCount, countPerMessage };
  }

  /** @internal */
  protected async _getNumTokensFromGenerations(generations: ChatGeneration[]) {
    const generationUsages = await Promise.all(
      generations.map(async (generation) => {
        if (generation.message.additional_kwargs?.function_call) {
          return (await this.getNumTokensFromMessages([generation.message]))
            .countPerMessage[0];
        } else {
          return await this.getNumTokens(generation.message.content);
        }
      })
    );

    return generationUsages.reduce((a, b) => a + b, 0);
  }

  /** @internal */
  protected async _getEstimatedTokenCountFromPrompt(
    messages: BaseMessage[],
    functions?: OpenAIClient.Chat.ChatCompletionCreateParams.Function[],
    function_call?:
      | "none"
      | "auto"
      | OpenAIClient.Chat.ChatCompletionFunctionCallOption
  ): Promise<number> {
    // It appears that if functions are present, the first system message is padded with a trailing newline. This
    // was inferred by trying lots of combinations of messages and functions and seeing what the token counts were.

    let tokens = (await this.getNumTokensFromMessages(messages)).totalCount;

    // If there are functions, add the function definitions as they count towards token usage
    if (functions && function_call !== "auto") {
      const promptDefinitions = formatFunctionDefinitions(
        functions as unknown as FunctionDef[]
      );
      tokens += await this.getNumTokens(promptDefinitions);
      tokens += 9; // Add nine per completion
    }

    // If there's a system message _and_ functions are present, subtract four tokens. I assume this is because
    // functions typically add a system message, but reuse the first one if it's already there. This offsets
    // the extra 9 tokens added by the function definitions.
    if (functions && messages.find((m) => m._getType() === "system")) {
      tokens -= 4;
    }

    // If function_call is 'none', add one token.
    // If it's a FunctionCall object, add 4 + the number of tokens in the function name.
    // If it's undefined or 'auto', don't add anything.
    if (function_call === "none") {
      tokens += 1;
    } else if (typeof function_call === "object") {
      tokens += (await this.getNumTokens(function_call.name)) + 4;
    }

    return tokens;
  }

  /**
   * Moderate content using OpenAI's Moderation API.
   *
   * This method checks whether content violates OpenAI's content policy by
   * analyzing text for categories such as hate, harassment, self-harm,
   * sexual content, violence, and more.
   *
   * @param input - The text or array of texts to moderate
   * @param params - Optional parameters for the moderation request
   * @param params.model - The moderation model to use. Defaults to "omni-moderation-latest".
   * @param params.options - Additional options to pass to the underlying request
   * @returns A promise that resolves to the moderation response containing results for each input
   *
   * @example
   * ```typescript
   * const model = new ChatOpenAI({ model: "gpt-4o-mini" });
   *
   * // Moderate a single text
   * const result = await model.moderateContent("This is a test message");
   * console.log(result.results[0].flagged); // false
   * console.log(result.results[0].categories); // { hate: false, harassment: false, ... }
   *
   * // Moderate multiple texts
   * const results = await model.moderateContent([
   *   "Hello, how are you?",
   *   "This is inappropriate content"
   * ]);
   * results.results.forEach((result, index) => {
   *   console.log(`Text ${index + 1} flagged:`, result.flagged);
   * });
   *
   * // Use a specific moderation model
   * const stableResult = await model.moderateContent(
   *   "Test content",
   *   { model: "omni-moderation-latest" }
   * );
   * ```
   */
  async moderateContent(
    input: string | string[],
    params?: {
      model?: OpenAI.ModerationModel;
      options?: OpenAICoreRequestOptions;
    }
  ): Promise<OpenAIClient.ModerationCreateResponse> {
    const clientOptions = this._getClientOptions(params?.options);
    const moderationModel = params?.model ?? "omni-moderation-latest";
    const moderationRequest: OpenAIClient.ModerationCreateParams = {
      input,
      model: moderationModel,
    };

    return this.caller.call(async () => {
      try {
        const response = await this.client.moderations.create(
          moderationRequest,
          clientOptions
        );
        return response;
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /**
   * Return profiling information for the model.
   *
   * Provides information about the model's capabilities and constraints,
   * including token limits, multimodal support, and advanced features like
   * tool calling and structured output.
   *
   * @returns {ModelProfile} An object describing the model's capabilities and constraints
   *
   * @example
   * ```typescript
   * const model = new ChatOpenAI({ model: "gpt-4o" });
   * const profile = model.profile;
   * console.log(profile.maxInputTokens); // 128000
   * console.log(profile.imageInputs); // true
   * ```
   */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  /** @internal */
  protected _getStructuredOutputMethod(
    config: StructuredOutputMethodOptions<boolean>
  ) {
    const ensuredConfig = { ...config };
    if (
      !this.model.startsWith("gpt-3") &&
      !this.model.startsWith("gpt-4-") &&
      this.model !== "gpt-4"
    ) {
      if (ensuredConfig?.method === undefined) {
        return "jsonSchema";
      }
    } else if (ensuredConfig.method === "jsonSchema") {
      console.warn(
        `[WARNING]: JSON Schema is not supported for model "${this.model}". Falling back to tool calling.`
      );
    }
    return ensuredConfig.method;
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  /**
   * Add structured output to the model.
   *
   * The OpenAI model family supports the following structured output methods:
   * - `jsonSchema`: Use the `response_format` field in the response to return a JSON schema. Only supported with the `gpt-4o-mini`,
   *   `gpt-4o-mini-2024-07-18`, and `gpt-4o-2024-08-06` model snapshots and later.
   * - `functionCalling`: Function calling is useful when you are building an application that bridges the models and functionality
   *   of your application.
   * - `jsonMode`: JSON mode is a more basic version of the Structured Outputs feature. While JSON mode ensures that model
   *   output is valid JSON, Structured Outputs reliably matches the model's output to the schema you specify.
   *   We recommend you use `functionCalling` or `jsonSchema` if it is supported for your use case.
   *
   * The default method is `functionCalling`.
   *
   * @see https://platform.openai.com/docs/guides/structured-outputs
   * @param outputSchema - The schema to use for structured output.
   * @param config - The structured output method options.
   * @returns The model with structured output.
   */
  withStructuredOutput<
    RunOutput extends Record<string, unknown> = Record<string, unknown>,
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

    if (config?.strict !== undefined && config.method === "jsonMode") {
      throw new Error(
        "Argument `strict` is only supported for `method` = 'function_calling'"
      );
    }

    const method = getStructuredOutputMethod(this.model, config?.method);

    if (method === "jsonMode") {
      if (isInteropZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
      const asJsonSchema = toJsonSchema(schema);
      llm = this.withConfig({
        outputVersion: "v0",
        response_format: { type: "json_object" },
        ls_structured_output_format: {
          kwargs: { method: "json_mode" },
          schema: { title: name ?? "extract", ...asJsonSchema },
        },
      } as Partial<CallOptions>);
    } else if (method === "jsonSchema") {
      const openaiJsonSchemaParams = {
        name: name ?? "extract",
        description: getSchemaDescription(schema),
        schema,
        strict: config?.strict,
      };
      const asJsonSchema = toJsonSchema(openaiJsonSchemaParams.schema);
      llm = this.withConfig({
        outputVersion: "v0",
        response_format: {
          type: "json_schema",
          json_schema: openaiJsonSchemaParams,
        },
        ls_structured_output_format: {
          kwargs: { method: "json_schema" },
          schema: {
            title: openaiJsonSchemaParams.name,
            description: openaiJsonSchemaParams.description,
            ...asJsonSchema,
          },
        },
      } as Partial<CallOptions>);
      if (isInteropZodSchema(schema)) {
        const altParser = StructuredOutputParser.fromZodSchema(schema);
        outputParser = RunnableLambda.from<AIMessageChunk, RunOutput>(
          (aiMessage: AIMessageChunk) => {
            if ("parsed" in aiMessage.additional_kwargs) {
              return aiMessage.additional_kwargs.parsed as RunOutput;
            }
            return altParser;
          }
        );
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      let functionName = name ?? "extract";
      // Is function calling
      if (isInteropZodSchema(schema)) {
        const asJsonSchema = toJsonSchema(schema);
        llm = this.withConfig({
          outputVersion: "v0",
          tools: [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description: asJsonSchema.description,
                parameters: asJsonSchema,
              },
            },
          ],
          tool_choice: {
            type: "function" as const,
            function: {
              name: functionName,
            },
          },
          ls_structured_output_format: {
            kwargs: { method: "function_calling" },
            schema: { title: functionName, ...asJsonSchema },
          },
          // Do not pass `strict` argument to OpenAI if `config.strict` is undefined
          ...(config?.strict !== undefined ? { strict: config.strict } : {}),
        } as Partial<CallOptions>);
        outputParser = new JsonOutputKeyToolsParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        let openAIFunctionDefinition: FunctionDefinition;
        if (
          typeof schema.name === "string" &&
          typeof schema.parameters === "object" &&
          schema.parameters != null
        ) {
          openAIFunctionDefinition = schema as unknown as FunctionDefinition;
          functionName = schema.name;
        } else {
          functionName = (schema.title as string) ?? functionName;
          openAIFunctionDefinition = {
            name: functionName,
            description: (schema.description as string) ?? "",
            parameters: schema,
          };
        }
        const asJsonSchema = toJsonSchema(schema);
        llm = this.withConfig({
          outputVersion: "v0",
          tools: [
            {
              type: "function" as const,
              function: openAIFunctionDefinition,
            },
          ],
          tool_choice: {
            type: "function" as const,
            function: {
              name: functionName,
            },
          },
          ls_structured_output_format: {
            kwargs: { method: "function_calling" },
            schema: { title: functionName, ...asJsonSchema },
          },
          // Do not pass `strict` argument to OpenAI if `config.strict` is undefined
          ...(config?.strict !== undefined ? { strict: config.strict } : {}),
        } as Partial<CallOptions>);
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
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
    >([{ raw: llm }, parsedWithFallback]);
  }
}
