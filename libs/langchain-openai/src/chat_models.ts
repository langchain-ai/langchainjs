import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import type {
  ChatCompletionContentPartText,
  ChatCompletionContentPartImage,
  ChatCompletionContentPartInputAudio,
  ChatCompletionContentPart,
} from "openai/resources/chat/completions";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  ToolMessage,
  ToolMessageChunk,
  OpenAIToolCall,
  isAIMessage,
  type UsageMetadata,
  type BaseMessageFields,
  type MessageContent,
  type InvalidToolCall,
  type MessageContentImageUrl,
  StandardContentBlockConverter,
  parseBase64DataUrl,
  parseMimeType,
  convertToProviderContentBlock,
  isDataContentBlock,
} from "@langchain/core/messages";
import {
  ChatGenerationChunk,
  type ChatGeneration,
  type ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  type LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  isOpenAITool as isOpenAIFunctionTool,
  type BaseFunctionCallOptions,
  type BaseLanguageModelInput,
  type FunctionDefinition,
  type StructuredOutputMethodOptions,
  type StructuredOutputMethodParams,
} from "@langchain/core/language_models/base";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
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
import {
  JsonOutputKeyToolsParser,
  convertLangChainToolCallToOpenAI,
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import type { ToolCall, ToolCallChunk } from "@langchain/core/messages/tool";
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
  ChatOpenAIReasoningSummary,
  ResponseFormatConfiguration,
  OpenAIVerbosityParam,
} from "./types.js";
import { type OpenAIEndpointConfig, getEndpoint } from "./utils/azure.js";
import {
  OpenAIToolChoice,
  formatToOpenAIToolChoice,
  interopZodResponseFormat,
  wrapOpenAIClientError,
} from "./utils/openai.js";
import {
  FunctionDef,
  formatFunctionDefinitions,
} from "./utils/openai-format-fndef.js";
import {
  _convertToOpenAITool,
  ChatOpenAIToolType,
  convertCompletionsCustomTool,
  convertResponsesCustomTool,
  isBuiltInTool,
  isBuiltInToolChoice,
  isCustomTool,
  isCustomToolCall,
  isOpenAICustomTool,
  parseCustomToolCall,
  ResponsesTool,
  ResponsesToolChoice,
} from "./utils/tools.js";
import {
  _convertOpenAIResponsesUsageToLangChainUsage,
  handleMultiModalOutput,
} from "./utils/output.js";

const _FUNCTION_CALL_IDS_MAP_KEY = "__openai_function_call_ids__";

interface OpenAILLMOutput {
  tokenUsage: {
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
  };
}

export type { OpenAICallOptions, OpenAIChatInput };

function isReasoningModel(model?: string) {
  if (!model) return false;
  if (/^o\d/.test(model ?? "")) return true;
  if (model.startsWith("gpt-5") && !model.startsWith("gpt-5-chat")) return true;
  return false;
}

function isStructuredOutputMethodParams(
  x: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): x is StructuredOutputMethodParams<Record<string, any>> {
  return (
    x !== undefined &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (x as StructuredOutputMethodParams<Record<string, any>>).schema ===
      "object"
  );
}

function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== "system" &&
    message.role !== "developer" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function" &&
    message.role !== "tool"
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as OpenAIClient.ChatCompletionRole;
}

export function messageToOpenAIRole(
  message: BaseMessage
): OpenAIClient.ChatCompletionRole {
  const type = message._getType();
  switch (type) {
    case "system":
      return "system";
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "function":
      return "function";
    case "tool":
      return "tool";
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

const completionsApiContentBlockConverter: StandardContentBlockConverter<{
  text: ChatCompletionContentPartText;
  image: ChatCompletionContentPartImage;
  audio: ChatCompletionContentPartInputAudio;
  file: ChatCompletionContentPart.File;
}> = {
  providerName: "ChatOpenAI",

  fromStandardTextBlock(block): ChatCompletionContentPartText {
    return { type: "text", text: block.text };
  },

  fromStandardImageBlock(block): ChatCompletionContentPartImage {
    if (block.source_type === "url") {
      return {
        type: "image_url",
        image_url: {
          url: block.url,
          ...(block.metadata?.detail
            ? { detail: block.metadata.detail as "auto" | "low" | "high" }
            : {}),
        },
      };
    }

    if (block.source_type === "base64") {
      const url = `data:${block.mime_type ?? ""};base64,${block.data}`;
      return {
        type: "image_url",
        image_url: {
          url,
          ...(block.metadata?.detail
            ? { detail: block.metadata.detail as "auto" | "low" | "high" }
            : {}),
        },
      };
    }

    throw new Error(
      `Image content blocks with source_type ${block.source_type} are not supported for ChatOpenAI`
    );
  },

  fromStandardAudioBlock(block): ChatCompletionContentPartInputAudio {
    if (block.source_type === "url") {
      const data = parseBase64DataUrl({ dataUrl: block.url });
      if (!data) {
        throw new Error(
          `URL audio blocks with source_type ${block.source_type} must be formatted as a data URL for ChatOpenAI`
        );
      }

      const rawMimeType = data.mime_type || block.mime_type || "";
      let mimeType: { type: string; subtype: string };

      try {
        mimeType = parseMimeType(rawMimeType);
      } catch {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      if (
        mimeType.type !== "audio" ||
        (mimeType.subtype !== "wav" && mimeType.subtype !== "mp3")
      ) {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      return {
        type: "input_audio",
        input_audio: {
          format: mimeType.subtype,
          data: data.data,
        },
      };
    }

    if (block.source_type === "base64") {
      let mimeType: { type: string; subtype: string };

      try {
        mimeType = parseMimeType(block.mime_type ?? "");
      } catch {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      if (
        mimeType.type !== "audio" ||
        (mimeType.subtype !== "wav" && mimeType.subtype !== "mp3")
      ) {
        throw new Error(
          `Audio blocks with source_type ${block.source_type} must have mime type of audio/wav or audio/mp3`
        );
      }

      return {
        type: "input_audio",
        input_audio: {
          format: mimeType.subtype,
          data: block.data,
        },
      };
    }

    throw new Error(
      `Audio content blocks with source_type ${block.source_type} are not supported for ChatOpenAI`
    );
  },

  fromStandardFileBlock(block): ChatCompletionContentPart.File {
    if (block.source_type === "url") {
      const data = parseBase64DataUrl({ dataUrl: block.url });
      if (!data) {
        throw new Error(
          `URL file blocks with source_type ${block.source_type} must be formatted as a data URL for ChatOpenAI`
        );
      }

      return {
        type: "file",
        file: {
          file_data: block.url, // formatted as base64 data URL
          ...(block.metadata?.filename || block.metadata?.name
            ? {
                filename: (block.metadata?.filename ||
                  block.metadata?.name) as string,
              }
            : {}),
        },
      };
    }

    if (block.source_type === "base64") {
      return {
        type: "file",
        file: {
          file_data: `data:${block.mime_type ?? ""};base64,${block.data}`,
          ...(block.metadata?.filename ||
          block.metadata?.name ||
          block.metadata?.title
            ? {
                filename: (block.metadata?.filename ||
                  block.metadata?.name ||
                  block.metadata?.title) as string,
              }
            : {}),
        },
      };
    }

    if (block.source_type === "id") {
      return {
        type: "file",
        file: {
          file_id: block.id,
        },
      };
    }

    throw new Error(
      `File content blocks with source_type ${block.source_type} are not supported for ChatOpenAI`
    );
  },
};

// Used in LangSmith, export is important here
// TODO: put this conversion elsewhere
export function _convertMessagesToOpenAIParams(
  messages: BaseMessage[],
  model?: string
): OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] {
  // TODO: Function messages do not support array content, fix cast
  return messages.flatMap((message) => {
    let role = messageToOpenAIRole(message);
    if (role === "system" && isReasoningModel(model)) {
      role = "developer";
    }

    const content =
      typeof message.content === "string"
        ? message.content
        : message.content.map((m) => {
            if (isDataContentBlock(m)) {
              return convertToProviderContentBlock(
                m,
                completionsApiContentBlockConverter
              );
            }
            return m;
          });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionParam: Record<string, any> = {
      role,
      content,
    };
    if (message.name != null) {
      completionParam.name = message.name;
    }
    if (message.additional_kwargs.function_call != null) {
      completionParam.function_call = message.additional_kwargs.function_call;
      completionParam.content = "";
    }
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
      completionParam.content = "";
    } else {
      if (message.additional_kwargs.tool_calls != null) {
        completionParam.tool_calls = message.additional_kwargs.tool_calls;
      }
      if ((message as ToolMessage).tool_call_id != null) {
        completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
      }
    }

    if (
      message.additional_kwargs.audio &&
      typeof message.additional_kwargs.audio === "object" &&
      "id" in message.additional_kwargs.audio
    ) {
      const audioMessage = {
        role: "assistant",
        audio: {
          id: message.additional_kwargs.audio.id,
        },
      };
      return [
        completionParam,
        audioMessage,
      ] as OpenAIClient.Chat.Completions.ChatCompletionMessageParam[];
    }

    return completionParam as OpenAIClient.Chat.Completions.ChatCompletionMessageParam;
  });
}

export interface BaseChatOpenAICallOptions
  extends OpenAICallOptions,
    BaseFunctionCallOptions {
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
    CallOptions extends BaseChatOpenAICallOptions
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

  apiKey?: string;

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
      "reasoningEffort",
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
      reasoningEffort: "reasoning_effort",
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
      "reasoningEffort",
      "promptCacheKey",
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

    this.apiKey =
      fields?.apiKey ??
      fields?.configuration?.apiKey ??
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
    this.reasoning =
      fields?.reasoning ?? fields?.reasoningEffort
        ? { effort: fields.reasoningEffort }
        : undefined;
    this.maxTokens = fields?.maxCompletionTokens ?? fields?.maxTokens;
    this.disableStreaming = fields?.disableStreaming === true;
    this.streaming = fields?.streaming === true;
    this.promptCacheKey = fields?.promptCacheKey ?? this.promptCacheKey;
    this.verbosity = fields?.verbosity ?? this.verbosity;

    // disable streaming in BaseChatModel if explicitly disabled
    if (fields?.streaming === false) this.disableStreaming = true;
    if (this.disableStreaming === true) this.streaming = false;

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
      tools: tools.map((tool) =>
        isBuiltInTool(tool)
          ? tool
          : this._convertChatOpenAIToolToCompletionsTool(tool, { strict })
      ),
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
        const textCount = await this.getNumTokens(message.content);
        const roleCount = await this.getNumTokens(messageToOpenAIRole(message));
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let schema: InteropZodType<RunOutput> | Record<string, any>;
    let name;
    let method;
    let includeRaw;
    if (isStructuredOutputMethodParams(outputSchema)) {
      schema = outputSchema.schema;
      name = outputSchema.name;
      method = outputSchema.method;
      includeRaw = outputSchema.includeRaw;
    } else {
      schema = outputSchema;
      name = config?.name;
      method = config?.method;
      includeRaw = config?.includeRaw;
    }
    let llm: Runnable<BaseLanguageModelInput>;
    let outputParser: Runnable<AIMessageChunk, RunOutput>;

    if (config?.strict !== undefined && method === "jsonMode") {
      throw new Error(
        "Argument `strict` is only supported for `method` = 'function_calling'"
      );
    }

    method = this._getStructuredOutputMethod({ ...config, method });

    if (method === "jsonMode") {
      if (isInteropZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
      const asJsonSchema = toJsonSchema(schema);
      llm = this.withConfig({
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
          openAIFunctionDefinition = schema as FunctionDefinition;
          functionName = schema.name;
        } else {
          functionName = schema.title ?? functionName;
          openAIFunctionDefinition = {
            name: functionName,
            description: schema.description ?? "",
            parameters: schema,
          };
        }
        const asJsonSchema = toJsonSchema(schema);
        llm = this.withConfig({
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

type ResponsesInputItem = OpenAIClient.Responses.ResponseInputItem;

type ExcludeController<T> = T extends { controller: unknown } ? never : T;

type ResponsesCreate = OpenAIClient.Responses["create"];
type ResponsesParse = OpenAIClient.Responses["parse"];

type ResponsesCreateInvoke = ExcludeController<
  Awaited<ReturnType<ResponsesCreate>>
>;
type ResponsesParseInvoke = ExcludeController<
  Awaited<ReturnType<ResponsesParse>>
>;

export interface ChatOpenAIResponsesCallOptions
  extends BaseChatOpenAICallOptions {
  /**
   * Configuration options for a text response from the model. Can be plain text or
   * structured JSON data.
   */
  text?: OpenAIClient.Responses.ResponseCreateParams["text"];

  /**
   * The truncation strategy to use for the model response.
   */
  truncation?: OpenAIClient.Responses.ResponseCreateParams["truncation"];

  /**
   * Specify additional output data to include in the model response.
   */
  include?: OpenAIClient.Responses.ResponseCreateParams["include"];

  /**
   * The unique ID of the previous response to the model. Use this to create multi-turn
   * conversations.
   */
  previous_response_id?: OpenAIClient.Responses.ResponseCreateParams["previous_response_id"];

  /**
   * The verbosity of the model's response.
   */
  verbosity?: OpenAIVerbosityParam;
}

type ChatResponsesInvocationParams = Omit<
  OpenAIClient.Responses.ResponseCreateParams,
  "input"
>;

/**
 * OpenAI Responses API implementation.
 *
 * Will be exported in a later version of @langchain/openai.
 *
 * @internal
 */
export class ChatOpenAIResponses<
  CallOptions extends ChatOpenAIResponsesCallOptions = ChatOpenAIResponsesCallOptions
> extends BaseChatOpenAI<CallOptions> {
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): ChatResponsesInvocationParams {
    let strict: boolean | undefined;
    if (options?.strict !== undefined) {
      strict = options.strict;
    } else if (this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }

    const params: ChatResponsesInvocationParams = {
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
      user: this.user,

      // if include_usage is set or streamUsage then stream must be set to true.
      stream: this.streaming,
      previous_response_id: options?.previous_response_id,
      truncation: options?.truncation,
      include: options?.include,
      tools: options?.tools?.length
        ? this._reduceChatOpenAITools(options.tools, {
            stream: this.streaming,
            strict,
          })
        : undefined,
      tool_choice: isBuiltInToolChoice(options?.tool_choice)
        ? options?.tool_choice
        : (() => {
            const formatted = formatToOpenAIToolChoice(options?.tool_choice);
            if (typeof formatted === "object" && "type" in formatted) {
              if (formatted.type === "function") {
                return { type: "function", name: formatted.function.name };
              } else if (formatted.type === "allowed_tools") {
                return {
                  type: "allowed_tools",
                  mode: formatted.allowed_tools.mode,
                  tools: formatted.allowed_tools.tools,
                };
              } else if (formatted.type === "custom") {
                return {
                  type: "custom",
                  name: formatted.custom.name,
                };
              }
            }
            return undefined;
          })(),
      text: (() => {
        if (options?.text) return options.text;
        const format = this._getResponseFormat(options?.response_format);
        if (format?.type === "json_schema") {
          if (format.json_schema.schema != null) {
            return {
              format: {
                type: "json_schema",
                schema: format.json_schema.schema,
                description: format.json_schema.description,
                name: format.json_schema.name,
                strict: format.json_schema.strict,
              },
              verbosity: options?.verbosity,
            };
          }
          return undefined;
        }
        return { format, verbosity: options?.verbosity };
      })(),
      parallel_tool_calls: options?.parallel_tool_calls,
      max_output_tokens: this.maxTokens === -1 ? undefined : this.maxTokens,
      prompt_cache_key: options?.promptCacheKey ?? this.promptCacheKey,
      ...(this.zdrEnabled ? { store: false } : {}),
      ...this.modelKwargs,
    };

    const reasoning = this._getReasoningParams(options);

    if (reasoning !== undefined) {
      params.reasoning = reasoning;
    }

    return params;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const invocationParams = this.invocationParams(options);
    if (invocationParams.stream) {
      const stream = this._streamResponseChunks(messages, options);
      let finalChunk: ChatGenerationChunk | undefined;
      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
        finalChunk = finalChunk?.concat(chunk) ?? chunk;
      }

      return {
        generations: finalChunk ? [finalChunk] : [],
        llmOutput: {
          estimatedTokenUsage: (finalChunk?.message as AIMessage | undefined)
            ?.usage_metadata,
        },
      };
    } else {
      const input = this._convertMessagesToResponsesParams(messages);
      const data = await this.completionWithRetry(
        {
          input,
          ...invocationParams,
          stream: false,
        },
        { signal: options?.signal, ...options?.options }
      );

      return {
        generations: [
          {
            text: data.output_text,
            message: this._convertResponsesMessageToBaseMessage(data),
          },
        ],
        llmOutput: {
          id: data.id,
          estimatedTokenUsage: data.usage
            ? {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.total_tokens,
              }
            : undefined,
        },
      };
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const streamIterable = await this.completionWithRetry(
      {
        ...this.invocationParams(options),
        input: this._convertMessagesToResponsesParams(messages),
        stream: true,
      },
      options
    );

    for await (const data of streamIterable) {
      const chunk = this._convertResponsesDeltaToBaseMessageChunk(data);
      if (chunk == null) continue;
      yield chunk;
      await runManager?.handleLLMNewToken(
        chunk.text || "",
        {
          prompt: options.promptIndex ?? 0,
          completion: 0,
        },
        undefined,
        undefined,
        undefined,
        { chunk }
      );
    }
  }

  /**
   * Calls the Responses API with retry logic in case of failures.
   * @param request The request to send to the OpenAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the OpenAI API.
   */
  async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>>;

  async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParamsNonStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<OpenAIClient.Responses.Response>;

  async completionWithRetry(
    request: OpenAIClient.Responses.ResponseCreateParams,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Responses.ResponseStreamEvent>
    | OpenAIClient.Responses.Response
  > {
    return this.caller.call(async () => {
      const clientOptions = this._getClientOptions(requestOptions);
      try {
        // use parse if dealing with json_schema
        if (request.text?.format?.type === "json_schema" && !request.stream) {
          return await this.client.responses.parse(request, clientOptions);
        }
        return await this.client.responses.create(request, clientOptions);
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /** @internal */
  protected _convertResponsesMessageToBaseMessage(
    response: ResponsesCreateInvoke | ResponsesParseInvoke
  ): BaseMessage {
    if (response.error) {
      // TODO: add support for `addLangChainErrorFields`
      const error = new Error(response.error.message);
      error.name = response.error.code;
      throw error;
    }

    let messageId: string | undefined;
    const content: MessageContent = [];
    const tool_calls: ToolCall[] = [];
    const invalid_tool_calls: InvalidToolCall[] = [];
    const response_metadata: Record<string, unknown> = {
      model: response.model,
      created_at: response.created_at,
      id: response.id,
      incomplete_details: response.incomplete_details,
      metadata: response.metadata,
      object: response.object,
      status: response.status,
      user: response.user,
      service_tier: response.service_tier,

      // for compatibility with chat completion calls.
      model_name: response.model,
    };

    const additional_kwargs: {
      [key: string]: unknown;
      refusal?: string;
      reasoning?: OpenAIClient.Responses.ResponseReasoningItem;
      tool_outputs?: unknown[];
      parsed?: unknown;
      [_FUNCTION_CALL_IDS_MAP_KEY]?: Record<string, string>;
    } = {};

    for (const item of response.output) {
      if (item.type === "message") {
        messageId = item.id;
        content.push(
          ...item.content.flatMap((part) => {
            if (part.type === "output_text") {
              if ("parsed" in part && part.parsed != null) {
                additional_kwargs.parsed = part.parsed;
              }
              return {
                type: "text",
                text: part.text,
                annotations: part.annotations,
              };
            }

            if (part.type === "refusal") {
              additional_kwargs.refusal = part.refusal;
              return [];
            }

            return part;
          })
        );
      } else if (item.type === "function_call") {
        const fnAdapter = {
          function: { name: item.name, arguments: item.arguments },
          id: item.call_id,
        };

        try {
          tool_calls.push(parseToolCall(fnAdapter, { returnId: true }));
        } catch (e: unknown) {
          let errMessage: string | undefined;
          if (
            typeof e === "object" &&
            e != null &&
            "message" in e &&
            typeof e.message === "string"
          ) {
            errMessage = e.message;
          }
          invalid_tool_calls.push(makeInvalidToolCall(fnAdapter, errMessage));
        }

        additional_kwargs[_FUNCTION_CALL_IDS_MAP_KEY] ??= {};
        if (item.id) {
          additional_kwargs[_FUNCTION_CALL_IDS_MAP_KEY][item.call_id] = item.id;
        }
      } else if (item.type === "reasoning") {
        additional_kwargs.reasoning = item;
      } else if (item.type === "custom_tool_call") {
        const parsed = parseCustomToolCall(item);
        if (parsed) {
          tool_calls.push(parsed);
        } else {
          invalid_tool_calls.push(
            makeInvalidToolCall(item, "Malformed custom tool call")
          );
        }
      } else {
        additional_kwargs.tool_outputs ??= [];
        additional_kwargs.tool_outputs.push(item);
      }
    }

    return new AIMessage({
      id: messageId,
      content,
      tool_calls,
      invalid_tool_calls,
      usage_metadata: _convertOpenAIResponsesUsageToLangChainUsage(
        response.usage
      ),
      additional_kwargs,
      response_metadata,
    });
  }

  /** @internal */
  protected _convertResponsesDeltaToBaseMessageChunk(
    chunk: OpenAIClient.Responses.ResponseStreamEvent
  ) {
    const content: Record<string, unknown>[] = [];
    let generationInfo: Record<string, unknown> = {};
    let usage_metadata: UsageMetadata | undefined;
    const tool_call_chunks: ToolCallChunk[] = [];
    const response_metadata: Record<string, unknown> = {};
    const additional_kwargs: {
      [key: string]: unknown;
      reasoning?: Partial<ChatOpenAIReasoningSummary>;
      tool_outputs?: unknown[];
    } = {};
    let id: string | undefined;
    if (chunk.type === "response.output_text.delta") {
      content.push({
        type: "text",
        text: chunk.delta,
        index: chunk.content_index,
      });
    } else if (chunk.type === "response.output_text.annotation.added") {
      content.push({
        type: "text",
        text: "",
        annotations: [chunk.annotation],
        index: chunk.content_index,
      });
    } else if (
      chunk.type === "response.output_item.added" &&
      chunk.item.type === "message"
    ) {
      id = chunk.item.id;
    } else if (
      chunk.type === "response.output_item.added" &&
      chunk.item.type === "function_call"
    ) {
      tool_call_chunks.push({
        type: "tool_call_chunk",
        name: chunk.item.name,
        args: chunk.item.arguments,
        id: chunk.item.call_id,
        index: chunk.output_index,
      });

      additional_kwargs[_FUNCTION_CALL_IDS_MAP_KEY] = {
        [chunk.item.call_id]: chunk.item.id,
      };
    } else if (
      chunk.type === "response.output_item.done" &&
      [
        "web_search_call",
        "file_search_call",
        "computer_call",
        "code_interpreter_call",
        "mcp_call",
        "mcp_list_tools",
        "mcp_approval_request",
        "image_generation_call",
        "custom_tool_call",
      ].includes(chunk.item.type)
    ) {
      additional_kwargs.tool_outputs = [chunk.item];
    } else if (chunk.type === "response.created") {
      response_metadata.id = chunk.response.id;
      response_metadata.model_name = chunk.response.model;
      response_metadata.model = chunk.response.model;
    } else if (chunk.type === "response.completed") {
      const msg = this._convertResponsesMessageToBaseMessage(chunk.response);

      usage_metadata = _convertOpenAIResponsesUsageToLangChainUsage(
        chunk.response.usage
      );

      if (chunk.response.text?.format?.type === "json_schema") {
        additional_kwargs.parsed ??= JSON.parse(msg.text);
      }
      for (const [key, value] of Object.entries(chunk.response)) {
        if (key !== "id") response_metadata[key] = value;
      }
    } else if (
      chunk.type === "response.function_call_arguments.delta" ||
      chunk.type === "response.custom_tool_call_input.delta"
    ) {
      tool_call_chunks.push({
        type: "tool_call_chunk",
        args: chunk.delta,
        index: chunk.output_index,
      });
    } else if (
      chunk.type === "response.web_search_call.completed" ||
      chunk.type === "response.file_search_call.completed"
    ) {
      generationInfo = {
        tool_outputs: {
          id: chunk.item_id,
          type: chunk.type.replace("response.", "").replace(".completed", ""),
          status: "completed",
        },
      };
    } else if (chunk.type === "response.refusal.done") {
      additional_kwargs.refusal = chunk.refusal;
    } else if (
      chunk.type === "response.output_item.added" &&
      "item" in chunk &&
      chunk.item.type === "reasoning"
    ) {
      const summary: ChatOpenAIReasoningSummary["summary"] | undefined = chunk
        .item.summary
        ? chunk.item.summary.map((s, index) => ({
            ...s,
            index,
          }))
        : undefined;

      additional_kwargs.reasoning = {
        // We only capture ID in the first chunk or else the concatenated result of all chunks will
        // have an ID field that is repeated once per chunk. There is special handling for the `type`
        // field that prevents this, however.
        id: chunk.item.id,
        type: chunk.item.type,
        ...(summary ? { summary } : {}),
      };
    } else if (chunk.type === "response.reasoning_summary_part.added") {
      additional_kwargs.reasoning = {
        type: "reasoning",
        summary: [{ ...chunk.part, index: chunk.summary_index }],
      };
    } else if (chunk.type === "response.reasoning_summary_text.delta") {
      additional_kwargs.reasoning = {
        type: "reasoning",
        summary: [
          {
            text: chunk.delta,
            type: "summary_text",
            index: chunk.summary_index,
          },
        ],
      };
    } else if (chunk.type === "response.image_generation_call.partial_image") {
      // noop/fixme: retaining partial images in a message chunk means that _all_
      // partial images get kept in history, so we don't do anything here.
      return null;
    } else {
      return null;
    }

    return new ChatGenerationChunk({
      // Legacy reasons, `onLLMNewToken` should pulls this out
      text: content.map((part) => part.text).join(""),
      message: new AIMessageChunk({
        id,
        content,
        tool_call_chunks,
        usage_metadata,
        additional_kwargs,
        response_metadata,
      }),
      generationInfo,
    });
  }

  /** @internal */
  protected _convertMessagesToResponsesParams(messages: BaseMessage[]) {
    return messages.flatMap(
      (lcMsg): ResponsesInputItem | ResponsesInputItem[] => {
        const additional_kwargs = lcMsg.additional_kwargs as
          | BaseMessageFields["additional_kwargs"] & {
              [_FUNCTION_CALL_IDS_MAP_KEY]?: Record<string, string>;
              reasoning?: OpenAIClient.Responses.ResponseReasoningItem;
              type?: string;
              refusal?: string;
            };

        let role = messageToOpenAIRole(lcMsg);
        if (role === "system" && isReasoningModel(this.model))
          role = "developer";

        if (role === "function") {
          throw new Error(
            "Function messages are not supported in Responses API"
          );
        }

        if (role === "tool") {
          const toolMessage = lcMsg as ToolMessage;

          // Handle computer call output
          if (additional_kwargs?.type === "computer_call_output") {
            const output = (() => {
              if (typeof toolMessage.content === "string") {
                return {
                  type: "computer_screenshot" as const,
                  image_url: toolMessage.content,
                };
              }

              if (Array.isArray(toolMessage.content)) {
                const oaiScreenshot = toolMessage.content.find(
                  (i) => i.type === "computer_screenshot"
                ) as { type: "computer_screenshot"; image_url: string };

                if (oaiScreenshot) return oaiScreenshot;

                const lcImage = toolMessage.content.find(
                  (i) => i.type === "image_url"
                ) as MessageContentImageUrl;

                if (lcImage) {
                  return {
                    type: "computer_screenshot" as const,
                    image_url:
                      typeof lcImage.image_url === "string"
                        ? lcImage.image_url
                        : lcImage.image_url.url,
                  };
                }
              }

              throw new Error("Invalid computer call output");
            })();

            return {
              type: "computer_call_output",
              output,
              call_id: toolMessage.tool_call_id,
            };
          }

          // Handle custom tool output
          if (toolMessage.metadata?.customTool) {
            return {
              type: "custom_tool_call_output",
              call_id: toolMessage.tool_call_id,
              output: toolMessage.content as string,
            };
          }

          return {
            type: "function_call_output",
            call_id: toolMessage.tool_call_id,
            id: toolMessage.id?.startsWith("fc_") ? toolMessage.id : undefined,
            output:
              typeof toolMessage.content !== "string"
                ? JSON.stringify(toolMessage.content)
                : toolMessage.content,
          };
        }

        if (role === "assistant") {
          // if we have the original response items, just reuse them
          if (
            !this.zdrEnabled &&
            lcMsg.response_metadata.output != null &&
            Array.isArray(lcMsg.response_metadata.output) &&
            lcMsg.response_metadata.output.length > 0 &&
            lcMsg.response_metadata.output.every((item) => "type" in item)
          ) {
            return lcMsg.response_metadata.output;
          }

          // otherwise, try to reconstruct the response from what we have

          const input: ResponsesInputItem[] = [];

          // reasoning items
          if (additional_kwargs?.reasoning && !this.zdrEnabled) {
            const reasoningItem = this._convertReasoningSummary(
              additional_kwargs.reasoning
            );
            input.push(reasoningItem);
          }

          // ai content
          let { content } = lcMsg;
          if (additional_kwargs?.refusal) {
            if (typeof content === "string") {
              content = [
                { type: "output_text", text: content, annotations: [] },
              ];
            }
            content = [
              ...content,
              { type: "refusal", refusal: additional_kwargs.refusal },
            ];
          }

          if (typeof content === "string" || content.length > 0) {
            input.push({
              type: "message",
              role: "assistant",
              ...(lcMsg.id && !this.zdrEnabled && lcMsg.id.startsWith("msg_")
                ? { id: lcMsg.id }
                : {}),
              content:
                typeof content === "string"
                  ? content
                  : content.flatMap((item) => {
                      if (item.type === "text") {
                        return {
                          type: "output_text",
                          text: item.text,
                          // @ts-expect-error TODO: add types for `annotations`
                          annotations: item.annotations ?? [],
                        };
                      }

                      if (
                        item.type === "output_text" ||
                        item.type === "refusal"
                      ) {
                        return item;
                      }

                      return [];
                    }),
            });
          }

          const functionCallIds =
            additional_kwargs?.[_FUNCTION_CALL_IDS_MAP_KEY];

          if (isAIMessage(lcMsg) && !!lcMsg.tool_calls?.length) {
            input.push(
              ...lcMsg.tool_calls.map((toolCall): ResponsesInputItem => {
                if (isCustomToolCall(toolCall)) {
                  return {
                    type: "custom_tool_call",
                    id: toolCall.call_id,
                    call_id: toolCall.id ?? "",
                    input: toolCall.args.input,
                    name: toolCall.name,
                  };
                }
                return {
                  type: "function_call",
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.args),
                  call_id: toolCall.id!,
                  ...(this.zdrEnabled
                    ? { id: functionCallIds?.[toolCall.id!] }
                    : {}),
                };
              })
            );
          } else if (additional_kwargs?.tool_calls) {
            input.push(
              ...additional_kwargs.tool_calls.map(
                (toolCall): ResponsesInputItem => ({
                  type: "function_call",
                  name: toolCall.function.name,
                  call_id: toolCall.id,
                  arguments: toolCall.function.arguments,
                  ...(this.zdrEnabled
                    ? { id: functionCallIds?.[toolCall.id] }
                    : {}),
                })
              )
            );
          }

          const toolOutputs = (
            lcMsg.response_metadata.output as Array<ResponsesInputItem>
          )?.length
            ? lcMsg.response_metadata.output
            : additional_kwargs.tool_outputs;

          const fallthroughCallTypes: ResponsesInputItem["type"][] = [
            "computer_call",
            "mcp_call",
            "code_interpreter_call",
            "image_generation_call",
          ];

          if (toolOutputs != null) {
            const castToolOutputs = toolOutputs as Array<ResponsesInputItem>;
            const fallthroughCalls = castToolOutputs?.filter((item) =>
              fallthroughCallTypes.includes(item.type)
            );
            if (fallthroughCalls.length > 0) input.push(...fallthroughCalls);
          }

          return input;
        }

        if (role === "user" || role === "system" || role === "developer") {
          if (typeof lcMsg.content === "string") {
            return { type: "message", role, content: lcMsg.content };
          }

          const messages: ResponsesInputItem[] = [];
          const content = lcMsg.content.flatMap((item) => {
            if (item.type === "mcp_approval_response") {
              messages.push({
                type: "mcp_approval_response",
                approval_request_id: item.approval_request_id,
                approve: item.approve,
              });
            }
            if (isDataContentBlock(item)) {
              return convertToProviderContentBlock(
                item,
                completionsApiContentBlockConverter
              );
            }
            if (item.type === "text") {
              return {
                type: "input_text",
                text: item.text,
              };
            }
            if (item.type === "image_url") {
              return {
                type: "input_image",
                image_url:
                  typeof item.image_url === "string"
                    ? item.image_url
                    : item.image_url.url,
                detail:
                  typeof item.image_url === "string"
                    ? "auto"
                    : item.image_url.detail,
              };
            }
            if (
              item.type === "input_text" ||
              item.type === "input_image" ||
              item.type === "input_file"
            ) {
              return item;
            }
            return [];
          });

          if (content.length > 0) {
            messages.push({ type: "message", role, content });
          }
          return messages;
        }

        console.warn(
          `Unsupported role found when converting to OpenAI Responses API: ${role}`
        );
        return [];
      }
    );
  }

  /** @internal */
  protected _convertReasoningSummary(
    reasoning: ChatOpenAIReasoningSummary
  ): OpenAIClient.Responses.ResponseReasoningItem {
    // combine summary parts that have the the same index and then remove the indexes
    const summary = (
      reasoning.summary.length > 1
        ? reasoning.summary.reduce(
            (acc, curr) => {
              const last = acc.at(-1);

              if (last!.index === curr.index) {
                last!.text += curr.text;
              } else {
                acc.push(curr);
              }
              return acc;
            },
            [{ ...reasoning.summary[0] }]
          )
        : reasoning.summary
    ).map((s) =>
      Object.fromEntries(Object.entries(s).filter(([k]) => k !== "index"))
    ) as OpenAIClient.Responses.ResponseReasoningItem.Summary[];

    return {
      ...reasoning,
      summary,
    } as OpenAIClient.Responses.ResponseReasoningItem;
  }

  /** @internal */
  protected _reduceChatOpenAITools(
    tools: ChatOpenAIToolType[],
    fields: { stream?: boolean; strict?: boolean }
  ): ResponsesTool[] {
    const reducedTools: ResponsesTool[] = [];
    for (const tool of tools) {
      if (isBuiltInTool(tool)) {
        if (tool.type === "image_generation" && fields?.stream) {
          // OpenAI sends a 400 error if partial_images is not set and we want to stream.
          // We also set it to 1 since we don't support partial images yet.
          tool.partial_images = 1;
        }
        reducedTools.push(tool);
      } else if (isOpenAIFunctionTool(tool)) {
        reducedTools.push({
          type: "function",
          name: tool.function.name,
          parameters: tool.function.parameters,
          description: tool.function.description,
          strict: fields?.strict ?? null,
        });
      } else if (isOpenAICustomTool(tool)) {
        reducedTools.push(convertCompletionsCustomTool(tool));
      }
    }
    return reducedTools;
  }
}

export interface ChatOpenAICompletionsCallOptions
  extends BaseChatOpenAICallOptions {}

type ChatCompletionsInvocationParams = Omit<
  OpenAIClient.Chat.Completions.ChatCompletionCreateParams,
  "messages"
>;

/**
 * OpenAI Completions API implementation.
 * @internal
 */
export class ChatOpenAICompletions<
  CallOptions extends ChatOpenAICompletionsCallOptions = ChatOpenAICompletionsCallOptions
> extends BaseChatOpenAI<CallOptions> {
  /** @internal */
  override invocationParams(
    options?: this["ParsedCallOptions"],
    extra?: { streaming?: boolean }
  ): ChatCompletionsInvocationParams {
    let strict: boolean | undefined;
    if (options?.strict !== undefined) {
      strict = options.strict;
    } else if (this.supportsStrictToolCalling !== undefined) {
      strict = this.supportsStrictToolCalling;
    }

    let streamOptionsConfig = {};
    if (options?.stream_options !== undefined) {
      streamOptionsConfig = { stream_options: options.stream_options };
    } else if (this.streamUsage && (this.streaming || extra?.streaming)) {
      streamOptionsConfig = { stream_options: { include_usage: true } };
    }

    const params: Partial<ChatCompletionsInvocationParams> = {
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      logprobs: this.logprobs,
      top_logprobs: this.topLogprobs,
      n: this.n,
      logit_bias: this.logitBias,
      stop: options?.stop ?? this.stopSequences,
      user: this.user,
      // if include_usage is set or streamUsage then stream must be set to true.
      stream: this.streaming,
      functions: options?.functions,
      function_call: options?.function_call,
      tools: options?.tools?.length
        ? options.tools.map((tool) =>
            this._convertChatOpenAIToolToCompletionsTool(tool, { strict })
          )
        : undefined,
      tool_choice: formatToOpenAIToolChoice(
        options?.tool_choice as OpenAIToolChoice
      ),
      response_format: this._getResponseFormat(options?.response_format),
      seed: options?.seed,
      ...streamOptionsConfig,
      parallel_tool_calls: options?.parallel_tool_calls,
      ...(this.audio || options?.audio
        ? { audio: this.audio || options?.audio }
        : {}),
      ...(this.modalities || options?.modalities
        ? { modalities: this.modalities || options?.modalities }
        : {}),
      ...this.modelKwargs,
      prompt_cache_key: options?.promptCacheKey ?? this.promptCacheKey,
      verbosity: options?.verbosity ?? this.verbosity,
    };
    if (options?.prediction !== undefined) {
      params.prediction = options.prediction;
    }
    if (this.service_tier !== undefined) {
      params.service_tier = this.service_tier;
    }
    if (options?.service_tier !== undefined) {
      params.service_tier = options.service_tier;
    }
    const reasoning = this._getReasoningParams(options);
    if (reasoning !== undefined && reasoning.effort !== undefined) {
      params.reasoning_effort = reasoning.effort;
    }
    if (isReasoningModel(params.model)) {
      params.max_completion_tokens =
        this.maxTokens === -1 ? undefined : this.maxTokens;
    } else {
      params.max_tokens = this.maxTokens === -1 ? undefined : this.maxTokens;
    }

    return params as ChatCompletionsInvocationParams;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const usageMetadata = {} as UsageMetadata;
    const params = this.invocationParams(options);
    const messagesMapped: OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] =
      _convertMessagesToOpenAIParams(messages, this.model);

    if (params.stream) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
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

      const { functions, function_call } = this.invocationParams(options);

      // OpenAI does not support token usage report under stream mode,
      // fallback to estimation.

      const promptTokenUsage = await this._getEstimatedTokenCountFromPrompt(
        messages,
        functions,
        function_call
      );
      const completionTokenUsage = await this._getNumTokensFromGenerations(
        generations
      );

      usageMetadata.input_tokens = promptTokenUsage;
      usageMetadata.output_tokens = completionTokenUsage;
      usageMetadata.total_tokens = promptTokenUsage + completionTokenUsage;
      return {
        generations,
        llmOutput: {
          estimatedTokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    } else {
      const data = await this.completionWithRetry(
        {
          ...params,
          stream: false,
          messages: messagesMapped,
        },
        {
          signal: options?.signal,
          ...options?.options,
        }
      );

      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
        prompt_tokens_details: promptTokensDetails,
        completion_tokens_details: completionTokensDetails,
      } = data?.usage ?? {};

      if (completionTokens) {
        usageMetadata.output_tokens =
          (usageMetadata.output_tokens ?? 0) + completionTokens;
      }

      if (promptTokens) {
        usageMetadata.input_tokens =
          (usageMetadata.input_tokens ?? 0) + promptTokens;
      }

      if (totalTokens) {
        usageMetadata.total_tokens =
          (usageMetadata.total_tokens ?? 0) + totalTokens;
      }

      if (
        promptTokensDetails?.audio_tokens !== null ||
        promptTokensDetails?.cached_tokens !== null
      ) {
        usageMetadata.input_token_details = {
          ...(promptTokensDetails?.audio_tokens !== null && {
            audio: promptTokensDetails?.audio_tokens,
          }),
          ...(promptTokensDetails?.cached_tokens !== null && {
            cache_read: promptTokensDetails?.cached_tokens,
          }),
        };
      }

      if (
        completionTokensDetails?.audio_tokens !== null ||
        completionTokensDetails?.reasoning_tokens !== null
      ) {
        usageMetadata.output_token_details = {
          ...(completionTokensDetails?.audio_tokens !== null && {
            audio: completionTokensDetails?.audio_tokens,
          }),
          ...(completionTokensDetails?.reasoning_tokens !== null && {
            reasoning: completionTokensDetails?.reasoning_tokens,
          }),
        };
      }

      const generations: ChatGeneration[] = [];
      for (const part of data?.choices ?? []) {
        const text = part.message?.content ?? "";
        const generation: ChatGeneration = {
          text,
          message: this._convertCompletionsMessageToBaseMessage(
            part.message ?? { role: "assistant" },
            data
          ),
        };
        generation.generationInfo = {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        };
        if (isAIMessage(generation.message)) {
          generation.message.usage_metadata = usageMetadata;
        }
        // Fields are not serialized unless passed to the constructor
        // Doing this ensures all fields on the message are serialized
        generation.message = new AIMessage(
          Object.fromEntries(
            Object.entries(generation.message).filter(
              ([key]) => !key.startsWith("lc_")
            )
          ) as BaseMessageFields
        );
        generations.push(generation);
      }
      return {
        generations,
        llmOutput: {
          tokenUsage: {
            promptTokens: usageMetadata.input_tokens,
            completionTokens: usageMetadata.output_tokens,
            totalTokens: usageMetadata.total_tokens,
          },
        },
      };
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesMapped: OpenAIClient.Chat.Completions.ChatCompletionMessageParam[] =
      _convertMessagesToOpenAIParams(messages, this.model);

    const params = {
      ...this.invocationParams(options, {
        streaming: true,
      }),
      messages: messagesMapped,
      stream: true as const,
    };
    let defaultRole: OpenAIClient.Chat.ChatCompletionRole | undefined;

    const streamIterable = await this.completionWithRetry(params, options);
    let usage: OpenAIClient.Completions.CompletionUsage | undefined;
    for await (const data of streamIterable) {
      const choice = data?.choices?.[0];
      if (data.usage) {
        usage = data.usage;
      }
      if (!choice) {
        continue;
      }

      const { delta } = choice;
      if (!delta) {
        continue;
      }
      const chunk = this._convertCompletionsDeltaToBaseMessageChunk(
        delta,
        data,
        defaultRole
      );
      defaultRole = delta.role ?? defaultRole;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      if (typeof chunk.content !== "string") {
        console.log(
          "[WARNING]: Received non-string content from OpenAI. This is currently not supported."
        );
        continue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generationInfo: Record<string, any> = { ...newTokenIndices };
      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason;
        // Only include system fingerprint in the last chunk for now
        // to avoid concatenation issues
        generationInfo.system_fingerprint = data.system_fingerprint;
        generationInfo.model_name = data.model;
        generationInfo.service_tier = data.service_tier;
      }
      if (this.logprobs) {
        generationInfo.logprobs = choice.logprobs;
      }
      const generationChunk = new ChatGenerationChunk({
        message: chunk,
        text: chunk.content,
        generationInfo,
      });
      yield generationChunk;
      await runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
    if (usage) {
      const inputTokenDetails = {
        ...(usage.prompt_tokens_details?.audio_tokens !== null && {
          audio: usage.prompt_tokens_details?.audio_tokens,
        }),
        ...(usage.prompt_tokens_details?.cached_tokens !== null && {
          cache_read: usage.prompt_tokens_details?.cached_tokens,
        }),
      };
      const outputTokenDetails = {
        ...(usage.completion_tokens_details?.audio_tokens !== null && {
          audio: usage.completion_tokens_details?.audio_tokens,
        }),
        ...(usage.completion_tokens_details?.reasoning_tokens !== null && {
          reasoning: usage.completion_tokens_details?.reasoning_tokens,
        }),
      };
      const generationChunk = new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          response_metadata: {
            usage: { ...usage },
          },
          usage_metadata: {
            input_tokens: usage.prompt_tokens,
            output_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            ...(Object.keys(inputTokenDetails).length > 0 && {
              input_token_details: inputTokenDetails,
            }),
            ...(Object.keys(outputTokenDetails).length > 0 && {
              output_token_details: outputTokenDetails,
            }),
          },
        }),
        text: "",
      });
      yield generationChunk;
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParams,
    requestOptions?: OpenAIClient.RequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>
    | OpenAIClient.Chat.Completions.ChatCompletion
  > {
    const clientOptions = this._getClientOptions(requestOptions);
    const isParseableFormat =
      request.response_format && request.response_format.type === "json_schema";
    return this.caller.call(async () => {
      try {
        if (isParseableFormat && !request.stream) {
          return await this.client.chat.completions.parse(
            request,
            clientOptions
          );
        } else {
          return await this.client.chat.completions.create(
            request,
            clientOptions
          );
        }
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /** @internal */
  protected _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.Chat.Completions.ChatCompletionMessage,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletion
  ): BaseMessage {
    const rawToolCalls: OpenAIToolCall[] | undefined = message.tool_calls as
      | OpenAIToolCall[]
      | undefined;
    switch (message.role) {
      case "assistant": {
        const toolCalls = [];
        const invalidToolCalls = [];
        for (const rawToolCall of rawToolCalls ?? []) {
          try {
            toolCalls.push(parseToolCall(rawToolCall, { returnId: true }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (e: any) {
            invalidToolCalls.push(makeInvalidToolCall(rawToolCall, e.message));
          }
        }
        const additional_kwargs: Record<string, unknown> = {
          function_call: message.function_call,
          tool_calls: rawToolCalls,
        };
        if (this.__includeRawResponse !== undefined) {
          additional_kwargs.__raw_response = rawResponse;
        }
        const response_metadata: Record<string, unknown> | undefined = {
          model_name: rawResponse.model,
          ...(rawResponse.system_fingerprint
            ? {
                usage: { ...rawResponse.usage },
                system_fingerprint: rawResponse.system_fingerprint,
              }
            : {}),
        };

        if (message.audio) {
          additional_kwargs.audio = message.audio;
        }

        const content = handleMultiModalOutput(
          message.content || "",
          rawResponse.choices?.[0]?.message
        );

        return new AIMessage({
          content,
          tool_calls: toolCalls,
          invalid_tool_calls: invalidToolCalls,
          additional_kwargs,
          response_metadata,
          id: rawResponse.id,
        });
      }
      default:
        return new ChatMessage(
          message.content || "",
          message.role ?? "unknown"
        );
    }
  }

  /** @internal */
  protected _convertCompletionsDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.Chat.Completions.ChatCompletionChunk,
    defaultRole?: OpenAIClient.Chat.ChatCompletionRole
  ) {
    const role = delta.role ?? defaultRole;
    const content = delta.content ?? "";
    let additional_kwargs: Record<string, unknown>;
    if (delta.function_call) {
      additional_kwargs = {
        function_call: delta.function_call,
      };
    } else if (delta.tool_calls) {
      additional_kwargs = {
        tool_calls: delta.tool_calls,
      };
    } else {
      additional_kwargs = {};
    }
    if (this.__includeRawResponse) {
      additional_kwargs.__raw_response = rawResponse;
    }

    if (delta.audio) {
      additional_kwargs.audio = {
        ...delta.audio,
        index: rawResponse.choices[0].index,
      };
    }

    const response_metadata = { usage: { ...rawResponse.usage } };
    if (role === "user") {
      return new HumanMessageChunk({ content, response_metadata });
    } else if (role === "assistant") {
      const toolCallChunks: ToolCallChunk[] = [];
      if (Array.isArray(delta.tool_calls)) {
        for (const rawToolCall of delta.tool_calls) {
          toolCallChunks.push({
            name: rawToolCall.function?.name,
            args: rawToolCall.function?.arguments,
            id: rawToolCall.id,
            index: rawToolCall.index,
            type: "tool_call_chunk",
          });
        }
      }
      return new AIMessageChunk({
        content,
        tool_call_chunks: toolCallChunks,
        additional_kwargs,
        id: rawResponse.id,
        response_metadata,
      });
    } else if (role === "system") {
      return new SystemMessageChunk({ content, response_metadata });
    } else if (role === "developer") {
      return new SystemMessageChunk({
        content,
        response_metadata,
        additional_kwargs: {
          __openai_role__: "developer",
        },
      });
    } else if (role === "function") {
      return new FunctionMessageChunk({
        content,
        additional_kwargs,
        name: delta.name,
        response_metadata,
      });
    } else if (role === "tool") {
      return new ToolMessageChunk({
        content,
        additional_kwargs,
        tool_call_id: delta.tool_call_id,
        response_metadata,
      });
    } else {
      return new ChatMessageChunk({ content, role, response_metadata });
    }
  }
}

export type ChatOpenAICallOptions = ChatOpenAICompletionsCallOptions &
  ChatOpenAIResponsesCallOptions;

export interface ChatOpenAIFields extends BaseChatOpenAIFields {
  /**
   * Whether to use the responses API for all requests. If `false` the responses API will be used
   * only when required in order to fulfill the request.
   */
  useResponsesApi?: boolean;
  /**
   * The completions chat instance
   * @internal
   */
  completions?: ChatOpenAICompletions;
  /**
   * The responses chat instance
   * @internal
   */
  responses?: ChatOpenAIResponses;
}

/**
 * OpenAI chat model integration.
 *
 * To use with Azure, import the `AzureChatOpenAI` class.
 *
 * Setup:
 * Install `@langchain/openai` and set an environment variable named `OPENAI_API_KEY`.
 *
 * ```bash
 * npm install @langchain/openai
 * export OPENAI_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_openai.ChatOpenAI.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_openai.ChatOpenAICallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.withConfig`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.withConfig`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.withConfig({
 *   stop: ["\n"],
 *   tools: [...],
 * });
 *
 * // When calling `.bindTools`, call options should be passed via the second argument
 * const llmWithTools = llm.bindTools(
 *   [...],
 *   {
 *     tool_choice: "auto",
 *   }
 * );
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 *
 * const llm = new ChatOpenAI({
 *   model: "gpt-4o-mini",
 *   temperature: 0,
 *   maxTokens: undefined,
 *   timeout: undefined,
 *   maxRetries: 2,
 *   // apiKey: "...",
 *   // configuration: {
 *   //   baseURL: "...",
 *   // }
 *   // organization: "...",
 *   // other params...
 * });
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Invoking</strong></summary>
 *
 * ```typescript
 * const input = `Translate "I love programming" into French.`;
 *
 * // Models also accept a list of chat messages or a formatted prompt
 * const result = await llm.invoke(input);
 * console.log(result);
 * ```
 *
 * ```txt
 * AIMessage {
 *   "id": "chatcmpl-9u4Mpu44CbPjwYFkTbeoZgvzB00Tz",
 *   "content": "J'adore la programmation.",
 *   "response_metadata": {
 *     "tokenUsage": {
 *       "completionTokens": 5,
 *       "promptTokens": 28,
 *       "totalTokens": 33
 *     },
 *     "finish_reason": "stop",
 *     "system_fingerprint": "fp_3aa7262c27"
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 28,
 *     "output_tokens": 5,
 *     "total_tokens": 33
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 *
 * ```typescript
 * for await (const chunk of await llm.stream(input)) {
 *   console.log(chunk);
 * }
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "id": "chatcmpl-9u4NWB7yUeHCKdLr6jP3HpaOYHTqs",
 *   "content": ""
 * }
 * AIMessageChunk {
 *   "content": "J"
 * }
 * AIMessageChunk {
 *   "content": "'adore"
 * }
 * AIMessageChunk {
 *   "content": " la"
 * }
 * AIMessageChunk {
 *   "content": " programmation",,
 * }
 * AIMessageChunk {
 *   "content": ".",,
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "response_metadata": {
 *     "finish_reason": "stop",
 *     "system_fingerprint": "fp_c9aa9c0491"
 *   },
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "usage_metadata": {
 *     "input_tokens": 28,
 *     "output_tokens": 5,
 *     "total_tokens": 33
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Aggregate Streamed Chunks</strong></summary>
 *
 * ```typescript
 * import { AIMessageChunk } from '@langchain/core/messages';
 * import { concat } from '@langchain/core/utils/stream';
 *
 * const stream = await llm.stream(input);
 * let full: AIMessageChunk | undefined;
 * for await (const chunk of stream) {
 *   full = !full ? chunk : concat(full, chunk);
 * }
 * console.log(full);
 * ```
 *
 * ```txt
 * AIMessageChunk {
 *   "id": "chatcmpl-9u4PnX6Fy7OmK46DASy0bH6cxn5Xu",
 *   "content": "J'adore la programmation.",
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0,
 *     "finish_reason": "stop",
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 28,
 *     "output_tokens": 5,
 *     "total_tokens": 33
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools(
 *   [GetWeather, GetPopulation],
 *   {
 *     // strict: true  // enforce tool args schema is respected
 *   }
 * );
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 *
 * ```txt
 * [
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call',
 *     id: 'call_uPU4FiFzoKAtMxfmPnfQL6UK'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'call_UNkEwuQsHrGYqgDQuH9nPAtX'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call',
 *     id: 'call_kL3OXxaq9OjIKqRTpvjaCH14'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'call_s9KQB1UWj45LLGaEnjz0179q'
 *   }
 * ]
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Structured Output</strong></summary>
 *
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().nullable().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke, {
 *   name: "Joke",
 *   strict: true, // Optionally enable OpenAI structured outputs
 * });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: 'Why was the cat sitting on the computer?',
 *   punchline: 'Because it wanted to keep an eye on the mouse!',
 *   rating: 7
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>JSON Object Response Format</strong></summary>
 *
 * ```typescript
 * const jsonLlm = llm.withConfig({ response_format: { type: "json_object" } });
 * const jsonLlmAiMsg = await jsonLlm.invoke(
 *   "Return a JSON object with key 'randomInts' and a value of 10 random ints in [0-99]"
 * );
 * console.log(jsonLlmAiMsg.content);
 * ```
 *
 * ```txt
 * {
 *   "randomInts": [23, 87, 45, 12, 78, 34, 56, 90, 11, 67]
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Multimodal</strong></summary>
 *
 * ```typescript
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * const imageUrl = "https://example.com/image.jpg";
 * const imageData = await fetch(imageUrl).then(res => res.arrayBuffer());
 * const base64Image = Buffer.from(imageData).toString('base64');
 *
 * const message = new HumanMessage({
 *   content: [
 *     { type: "text", text: "describe the weather in this image" },
 *     {
 *       type: "image_url",
 *       image_url: { url: `data:image/jpeg;base64,${base64Image}` },
 *     },
 *   ]
 * });
 *
 * const imageDescriptionAiMsg = await llm.invoke([message]);
 * console.log(imageDescriptionAiMsg.content);
 * ```
 *
 * ```txt
 * The weather in the image appears to be clear and sunny. The sky is mostly blue with a few scattered white clouds, indicating fair weather. The bright sunlight is casting shadows on the green, grassy hill, suggesting it is a pleasant day with good visibility. There are no signs of rain or stormy conditions.
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Usage Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(input);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 28, output_tokens: 5, total_tokens: 33 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Logprobs</strong></summary>
 *
 * ```typescript
 * const logprobsLlm = new ChatOpenAI({ model: "gpt-4o-mini", logprobs: true });
 * const aiMsgForLogprobs = await logprobsLlm.invoke(input);
 * console.log(aiMsgForLogprobs.response_metadata.logprobs);
 * ```
 *
 * ```txt
 * {
 *   content: [
 *     {
 *       token: 'J',
 *       logprob: -0.000050616763,
 *       bytes: [Array],
 *       top_logprobs: []
 *     },
 *     {
 *       token: "'",
 *       logprob: -0.01868736,
 *       bytes: [Array],
 *       top_logprobs: []
 *     },
 *     {
 *       token: 'ad',
 *       logprob: -0.0000030545007,
 *       bytes: [Array],
 *       top_logprobs: []
 *     },
 *     { token: 'ore', logprob: 0, bytes: [Array], top_logprobs: [] },
 *     {
 *       token: ' la',
 *       logprob: -0.515404,
 *       bytes: [Array],
 *       top_logprobs: []
 *     },
 *     {
 *       token: ' programm',
 *       logprob: -0.0000118755715,
 *       bytes: [Array],
 *       top_logprobs: []
 *     },
 *     { token: 'ation', logprob: 0, bytes: [Array], top_logprobs: [] },
 *     {
 *       token: '.',
 *       logprob: -0.0000037697225,
 *       bytes: [Array],
 *       top_logprobs: []
 *     }
 *   ],
 *   refusal: null
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Response Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForResponseMetadata = await llm.invoke(input);
 * console.log(aiMsgForResponseMetadata.response_metadata);
 * ```
 *
 * ```txt
 * {
 *   tokenUsage: { completionTokens: 5, promptTokens: 28, totalTokens: 33 },
 *   finish_reason: 'stop',
 *   system_fingerprint: 'fp_3aa7262c27'
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>JSON Schema Structured Output</strong></summary>
 *
 * ```typescript
 * const llmForJsonSchema = new ChatOpenAI({
 *   model: "gpt-4o-2024-08-06",
 * }).withStructuredOutput(
 *   z.object({
 *     command: z.string().describe("The command to execute"),
 *     expectedOutput: z.string().describe("The expected output of the command"),
 *     options: z
 *       .array(z.string())
 *       .describe("The options you can pass to the command"),
 *   }),
 *   {
 *     method: "jsonSchema",
 *     strict: true, // Optional when using the `jsonSchema` method
 *   }
 * );
 *
 * const jsonSchemaRes = await llmForJsonSchema.invoke(
 *   "What is the command to list files in a directory?"
 * );
 * console.log(jsonSchemaRes);
 * ```
 *
 * ```txt
 * {
 *   command: 'ls',
 *   expectedOutput: 'A list of files and subdirectories within the specified directory.',
 *   options: [
 *     '-a: include directory entries whose names begin with a dot (.).',
 *     '-l: use a long listing format.',
 *     '-h: with -l, print sizes in human readable format (e.g., 1K, 234M, 2G).',
 *     '-t: sort by time, newest first.',
 *     '-r: reverse order while sorting.',
 *     '-S: sort by file size, largest first.',
 *     '-R: list subdirectories recursively.'
 *   ]
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Audio Outputs</strong></summary>
 *
 * ```typescript
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * const modelWithAudioOutput = new ChatOpenAI({
 *   model: "gpt-4o-audio-preview",
 *   // You may also pass these fields to `.withConfig` as a call argument.
 *   modalities: ["text", "audio"], // Specifies that the model should output audio.
 *   audio: {
 *     voice: "alloy",
 *     format: "wav",
 *   },
 * });
 *
 * const audioOutputResult = await modelWithAudioOutput.invoke("Tell me a joke about cats.");
 * const castMessageContent = audioOutputResult.content[0] as Record<string, any>;
 *
 * console.log({
 *   ...castMessageContent,
 *   data: castMessageContent.data.slice(0, 100) // Sliced for brevity
 * })
 * ```
 *
 * ```txt
 * {
 *   id: 'audio_67117718c6008190a3afad3e3054b9b6',
 *   data: 'UklGRqYwBgBXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNTguMjkuMTAwAGRhdGFg',
 *   expires_at: 1729201448,
 *   transcript: 'Sure! Why did the cat sit on the computer? Because it wanted to keep an eye on the mouse!'
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Audio Outputs</strong></summary>
 *
 * ```typescript
 * import { ChatOpenAI } from "@langchain/openai";
 *
 * const modelWithAudioOutput = new ChatOpenAI({
 *   model: "gpt-4o-audio-preview",
 *   // You may also pass these fields to `.withConfig` as a call argument.
 *   modalities: ["text", "audio"], // Specifies that the model should output audio.
 *   audio: {
 *     voice: "alloy",
 *     format: "wav",
 *   },
 * });
 *
 * const audioOutputResult = await modelWithAudioOutput.invoke("Tell me a joke about cats.");
 * const castAudioContent = audioOutputResult.additional_kwargs.audio as Record<string, any>;
 *
 * console.log({
 *   ...castAudioContent,
 *   data: castAudioContent.data.slice(0, 100) // Sliced for brevity
 * })
 * ```
 *
 * ```txt
 * {
 *   id: 'audio_67117718c6008190a3afad3e3054b9b6',
 *   data: 'UklGRqYwBgBXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAATElTVBoAAABJTkZPSVNGVA4AAABMYXZmNTguMjkuMTAwAGRhdGFg',
 *   expires_at: 1729201448,
 *   transcript: 'Sure! Why did the cat sit on the computer? Because it wanted to keep an eye on the mouse!'
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatOpenAI<
  CallOptions extends ChatOpenAICallOptions = ChatOpenAICallOptions
> extends BaseChatOpenAI<CallOptions> {
  /**
   * Whether to use the responses API for all requests. If `false` the responses API will be used
   * only when required in order to fulfill the request.
   */
  useResponsesApi: boolean = false;

  protected responses: ChatOpenAIResponses;

  protected completions: ChatOpenAICompletions;

  get lc_serializable_keys(): string[] {
    return [...super.lc_serializable_keys, "useResponsesApi"];
  }

  constructor(protected fields?: ChatOpenAIFields) {
    super(fields);
    this.useResponsesApi = fields?.useResponsesApi ?? false;
    this.responses = fields?.responses ?? new ChatOpenAIResponses(fields);
    this.completions = fields?.completions ?? new ChatOpenAICompletions(fields);
  }

  protected _useResponsesApi(options: this["ParsedCallOptions"] | undefined) {
    const usesBuiltInTools = options?.tools?.some(isBuiltInTool);
    const hasResponsesOnlyKwargs =
      options?.previous_response_id != null ||
      options?.text != null ||
      options?.truncation != null ||
      options?.include != null ||
      options?.reasoning?.summary != null ||
      this.reasoning?.summary != null;
    const hasCustomTools = options?.tools?.some(isOpenAICustomTool);

    return (
      this.useResponsesApi ||
      usesBuiltInTools ||
      hasResponsesOnlyKwargs ||
      hasCustomTools
    );
  }

  override getLsParams(options: this["ParsedCallOptions"]) {
    const optionsWithDefaults = this._combineCallOptions(options);
    if (this._useResponsesApi(options)) {
      return this.responses.getLsParams(optionsWithDefaults);
    }
    return this.completions.getLsParams(optionsWithDefaults);
  }

  override invocationParams(options?: this["ParsedCallOptions"]) {
    const optionsWithDefaults = this._combineCallOptions(options);
    if (this._useResponsesApi(options)) {
      return this.responses.invocationParams(optionsWithDefaults);
    }
    return this.completions.invocationParams(optionsWithDefaults);
  }

  /** @ignore */
  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this._useResponsesApi(options)) {
      return this.responses._generate(messages, options);
    }
    return this.completions._generate(messages, options, runManager);
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this._useResponsesApi(options)) {
      yield* this.responses._streamResponseChunks(
        messages,
        this._combineCallOptions(options),
        runManager
      );
      return;
    }
    yield* this.completions._streamResponseChunks(
      messages,
      this._combineCallOptions(options),
      runManager
    );
  }

  override withConfig(
    config: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    const newModel = new ChatOpenAI<CallOptions>(this.fields);
    newModel.defaultOptions = { ...this.defaultOptions, ...config };
    return newModel;
  }
}
