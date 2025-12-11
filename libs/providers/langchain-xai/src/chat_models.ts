import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import {
  BaseChatModelCallOptions,
  BindToolsInput,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  isLangChainTool,
  convertToOpenAITool,
} from "@langchain/core/utils/function_calling";
import { ModelProfile } from "@langchain/core/language_models/profile";
import { Serialized } from "@langchain/core/load/serializable";
import {
  AIMessageChunk,
  BaseMessage,
  type UsageMetadata,
} from "@langchain/core/messages";
import { Runnable } from "@langchain/core/runnables";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { InteropZodType } from "@langchain/core/utils/types";
import {
  type OpenAICoreRequestOptions,
  type OpenAIClient,
  ChatOpenAICompletions,
} from "@langchain/openai";
import {
  buildSearchParametersPayload,
  filterXAIBuiltInTools,
  mergeSearchParams,
  type XAISearchParameters,
  type XAISearchParametersPayload,
} from "./live_search.js";
import PROFILES from "./profiles.js";
import {
  XAI_LIVE_SEARCH_TOOL_TYPE,
  XAILiveSearchTool,
} from "./tools/live_search.js";

export type OpenAIToolChoice =
  | OpenAIClient.ChatCompletionToolChoiceOption
  | "any"
  | string;

/**
 * Union type for all xAI built-in server-side tools.
 */
export type XAIBuiltInTool = XAILiveSearchTool;

/**
 * Set of all supported xAI built-in server-side tool types.
 * This allows us to easily extend support for future built-in tools
 * without changing the core detection logic.
 */
const XAI_BUILT_IN_TOOL_TYPES = new Set<XAILiveSearchTool["type"] | string>([
  XAI_LIVE_SEARCH_TOOL_TYPE,
]);

/**
 * Tool type that includes both standard tools and xAI built-in tools.
 */
type ChatXAIToolType =
  | BindToolsInput
  | OpenAIClient.ChatCompletionTool
  | XAIBuiltInTool;

/**
 * xAI-specific invocation parameters that extend the OpenAI completion params
 * with xAI's search_parameters field.
 */
export type ChatXAICompletionsInvocationParams = Omit<
  OpenAIClient.Chat.Completions.ChatCompletionCreateParams,
  "messages"
> & {
  /**
   * Search parameters for xAI's Live Search API.
   * When present, enables the model to search the web for real-time information.
   */
  search_parameters?: XAISearchParametersPayload;
};

/**
 * xAI-specific additional kwargs that may be present on AI messages.
 * Includes xAI-specific fields like reasoning_content.
 */
export interface XAIAdditionalKwargs {
  /**
   * The reasoning content from xAI models that support chain-of-thought reasoning.
   * This contains the model's internal reasoning process.
   */
  reasoning_content?: string;
  /**
   * Tool calls made by the model.
   */
  tool_calls?: OpenAIClient.ChatCompletionMessageToolCall[];
  /**
   * Additional properties that may be present.
   */
  [key: string]: unknown;
}

/**
 * xAI-specific response metadata that may include usage information.
 */
export interface XAIResponseMetadata {
  /**
   * Token usage information.
   */
  usage?: UsageMetadata;
  /**
   * Additional metadata properties.
   */
  [key: string]: unknown;
}

/**
 * Checks if a tool is an xAI built-in tool (like live_search).
 * Built-in tools are executed server-side by the xAI API.
 *
 * @param tool - The tool to check
 * @returns true if the tool is an xAI built-in tool
 */
export function isXAIBuiltInTool(
  tool: ChatXAIToolType
): tool is XAIBuiltInTool {
  return (
    typeof tool === "object" &&
    tool !== null &&
    "type" in tool &&
    typeof (tool as { type?: unknown }).type === "string" &&
    XAI_BUILT_IN_TOOL_TYPES.has((tool as { type: string }).type)
  );
}

export interface ChatXAICallOptions extends BaseChatModelCallOptions {
  headers?: Record<string, string>;
  /**
   * A list of tools the model may call.
   * Can include standard function tools and xAI built-in tools like `{ type: "live_search" }`.
   *
   * @example
   * ```typescript
   * // Using built-in live_search tool
   * const llm = new ChatXAI().bindTools([{ type: "live_search" }]);
   * const result = await llm.invoke("What happened in tech news today?");
   * ```
   */
  tools?: ChatXAIToolType[];
  tool_choice?: OpenAIToolChoice | string | "auto" | "any";
  /**
   * Search parameters for xAI's Live Search API.
   * Enables the model to search the web for real-time information.
   *
   * @note This is an alternative to using `tools: [{ type: "live_search" }]`.
   * The Live Search API parameters approach may be deprecated in favor of
   * the tool-based approach.
   *
   * @example
   * ```typescript
   * const result = await llm.invoke("What's the latest news?", {
   *   searchParameters: {
   *     mode: "auto",
   *     max_search_results: 5,
   *   }
   * });
   * ```
   */
  searchParameters?: XAISearchParameters;
}

export interface ChatXAIInput extends BaseChatModelParams {
  /**
   * The xAI API key to use for requests.
   * @default process.env.XAI_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default "grok-beta"
   */
  model?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   * Alias for `stopSequences`
   */
  stop?: Array<string>;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   */
  stopSequences?: Array<string>;
  /**
   * Whether or not to stream responses.
   */
  streaming?: boolean;
  /**
   * The temperature to use for sampling.
   * @default 0.7
   */
  temperature?: number;
  /**
   * The maximum number of tokens that the model can process in a single response.
   * This limits ensures computational efficiency and resource management.
   */
  maxTokens?: number;
  /**
   * Default search parameters for xAI's Live Search API.
   * When set, these parameters will be applied to all requests unless
   * overridden in the call options.
   *
   * @example
   * ```typescript
   * const llm = new ChatXAI({
   *   model: "grok-beta",
   *   searchParameters: {
   *     mode: "auto",
   *     max_search_results: 5,
   *   }
   * });
   * ```
   */
  searchParameters?: XAISearchParameters;
}

/**
 * xAI chat model integration.
 *
 * The xAI API is compatible to the OpenAI API with some limitations.
 *
 * Setup:
 * Install `@langchain/xai` and set an environment variable named `XAI_API_KEY`.
 *
 * ```bash
 * npm install @langchain/xai
 * export XAI_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_xai.ChatXAI.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/_langchain_xai.ChatXAICallOptions.html)
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
 * import { ChatXAI } from '@langchain/xai';
 *
 * const llm = new ChatXAI({
 *   model: "grok-beta",
 *   temperature: 0,
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
 *   "content": "The French translation of \"I love programming\" is \"J'aime programmer\". In this sentence, \"J'aime\" is the first person singular conjugation of the French verb \"aimer\" which means \"to love\", and \"programmer\" is the French infinitive for \"to program\". I hope this helps! Let me know if you have any other questions.",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "tokenUsage": {
 *       "completionTokens": 82,
 *       "promptTokens": 20,
 *       "totalTokens": 102
 *     },
 *     "finish_reason": "stop"
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": []
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
 *   "content": "",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "The",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " French",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " translation",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " of",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " \"",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "I",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " love",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * ...
 * AIMessageChunk {
 *   "content": ".",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": null
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": "stop"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
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
 *   "content": "The French translation of \"I love programming\" is \"J'aime programmer\". In this sentence, \"J'aime\" is the first person singular conjugation of the French verb \"aimer\" which means \"to love\", and \"programmer\" is the French infinitive for \"to program\". I hope this helps! Let me know if you have any other questions.",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finishReason": "stop"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
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
 * const llmForToolCalling = new ChatXAI({
 *   model: "grok-beta",
 *   temperature: 0,
 *   // other params...
 * });
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
 * const llmWithTools = llmForToolCalling.bindTools([GetWeather, GetPopulation]);
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
 *     id: 'call_cd34'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'call_68rf'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call',
 *     id: 'call_f81z'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'call_8byt'
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
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llmForToolCalling.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the wild?",
 *   punchline: 'Because there are too many cheetahs.'
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Server Tool Calling (Live Search)</strong></summary>
 *
 * xAI supports server-side tools that are executed by the API rather than
 * requiring client-side execution. The `live_search` tool enables the model
 * to search the web for real-time information.
 *
 * ```typescript
 * // Method 1: Using the built-in live_search tool
 * const llm = new ChatXAI({
 *   model: "grok-beta",
 *   temperature: 0,
 * });
 *
 * const llmWithSearch = llm.bindTools([{ type: "live_search" }]);
 * const result = await llmWithSearch.invoke("What happened in tech news today?");
 * console.log(result.content);
 * // The model will search the web and include real-time information in its response
 * ```
 *
 * ```typescript
 * // Method 2: Using searchParameters for more control
 * const llm = new ChatXAI({
 *   model: "grok-beta",
 *   searchParameters: {
 *     mode: "auto", // "auto" | "on" | "off"
 *     max_search_results: 5,
 *     from_date: "2024-01-01", // ISO date string
 *     return_citations: true,
 *   }
 * });
 *
 * const result = await llm.invoke("What are the latest AI developments?");
 * ```
 *
 * ```typescript
 * // Method 3: Override search parameters per request
 * const result = await llm.invoke("Find recent news about SpaceX", {
 *   searchParameters: {
 *     mode: "on",
 *     max_search_results: 10,
 *     sources: [
 *       { type: "web", allowed_websites: ["spacex.com", "nasa.gov"] },
 *     ],
 *   }
 * });
 * ```
 * </details>
 *
 * <br />
 */
export class ChatXAI extends ChatOpenAICompletions<ChatXAICallOptions> {
  static lc_name() {
    return "ChatXAI";
  }

  _llmType() {
    return "xai";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "XAI_API_KEY",
    };
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "chat_models", "xai"];

  /**
   * Default search parameters for the Live Search API.
   */
  searchParameters?: XAISearchParameters;

  constructor(fields?: Partial<ChatXAIInput>) {
    const apiKey = fields?.apiKey || getEnvironmentVariable("XAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        `xAI API key not found. Please set the XAI_API_KEY environment variable or provide the key into "apiKey" field.`
      );
    }

    super({
      ...fields,
      model: fields?.model || "grok-beta",
      apiKey,
      configuration: {
        baseURL: "https://api.x.ai/v1",
      },
    });

    this.searchParameters = fields?.searchParameters;
  }

  toJSON(): Serialized {
    const result = super.toJSON();

    if (
      "kwargs" in result &&
      typeof result.kwargs === "object" &&
      result.kwargs != null
    ) {
      delete result.kwargs.openai_api_key;
      delete result.kwargs.configuration;
    }

    return result;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "xai";
    return params;
  }

  /**
   * Get the effective search parameters, merging defaults with call options.
   * @param options Call options that may contain search parameters
   * @returns Merged search parameters or undefined if none are configured
   */
  protected _getEffectiveSearchParameters(
    options?: this["ParsedCallOptions"]
  ): XAISearchParameters | undefined {
    return mergeSearchParams(this.searchParameters, options?.searchParameters);
  }

  /**
   * Check if any built-in tools (like live_search) are in the tools list.
   * @param tools List of tools to check
   * @returns true if any built-in tools are present
   */
  protected _hasBuiltInTools(tools?: ChatXAIToolType[]): boolean {
    return tools?.some(isXAIBuiltInTool) ?? false;
  }

  /**
   * Formats tools to xAI/OpenAI format, preserving provider-specific definitions.
   *
   * @param tools The tools to format
   * @returns The formatted tools
   */
  formatStructuredToolToXAI(
    tools: ChatXAIToolType[]
  ): (OpenAIClient.ChatCompletionTool | XAIBuiltInTool)[] | undefined {
    if (!tools || !tools.length) {
      return undefined;
    }
    return tools.map((tool) => {
      // 1. Check for provider definition first (from xaiLiveSearch factory)
      if (isLangChainTool(tool) && tool.extras?.providerToolDefinition) {
        return tool.extras.providerToolDefinition as XAIBuiltInTool;
      }
      // 2. Check for built-in tools (legacy { type: "live_search" })
      if (isXAIBuiltInTool(tool)) {
        return tool;
      }
      // 3. Convert standard tools to OpenAI format
      return convertToOpenAITool(tool) as OpenAIClient.ChatCompletionTool;
    });
  }

  override bindTools(
    tools: ChatXAIToolType[],
    kwargs?: Partial<ChatXAICallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatXAICallOptions> {
    return this.withConfig({
      tools: this.formatStructuredToolToXAI(tools),
      ...kwargs,
    } as Partial<ChatXAICallOptions>);
  }

  /** @internal */
  override invocationParams(
    options?: this["ParsedCallOptions"],
    extra?: { streaming?: boolean }
  ): ChatXAICompletionsInvocationParams {
    const baseParams = super.invocationParams(options, extra);

    // Cast to xAI-specific params type
    const params: ChatXAICompletionsInvocationParams = { ...baseParams };

    // Check if live_search tool is being used
    // We also need to extract params from the tool definition if present
    const liveSearchTool = options?.tools?.find(isXAIBuiltInTool) as
      | XAILiveSearchTool
      | undefined;

    const mergedSearchParams = mergeSearchParams(
      this.searchParameters,
      options?.searchParameters,
      liveSearchTool
    );

    // Add search_parameters if needed
    if (mergedSearchParams) {
      params.search_parameters =
        buildSearchParametersPayload(mergedSearchParams);
    }

    return params;
  }

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  /**
   * Calls the xAI API with retry logic in case of failures.
   * @param request The request to send to the xAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the xAI API.
   */
  async completionWithRetry(
    request:
      | OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
      | OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>
    | OpenAIClient.Chat.Completions.ChatCompletion
  > {
    delete request.frequency_penalty;
    delete request.presence_penalty;
    delete request.logit_bias;
    delete request.functions;

    const newRequestMessages = request.messages.map((msg) => {
      if (!msg.content) {
        return {
          ...msg,
          content: "",
        };
      }
      return msg;
    });

    let filteredTools: OpenAIClient.ChatCompletionTool[] | undefined;
    if (request.tools) {
      filteredTools = filterXAIBuiltInTools({
        tools: request.tools,
        excludedTypes: [XAI_LIVE_SEARCH_TOOL_TYPE],
      }) as OpenAIClient.ChatCompletionTool[] | undefined;
    }

    const newRequest = {
      ...request,
      messages: newRequestMessages,
      tools: filteredTools,
    };

    if (newRequest.stream === true) {
      return super.completionWithRetry(newRequest, options);
    }

    return super.completionWithRetry(newRequest, options);
  }

  protected override _convertCompletionsDeltaToBaseMessageChunk(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delta: Record<string, any>,
    rawResponse: OpenAIClient.ChatCompletionChunk,
    defaultRole?:
      | "function"
      | "user"
      | "system"
      | "developer"
      | "assistant"
      | "tool"
  ): AIMessageChunk {
    const messageChunk = super._convertCompletionsDeltaToBaseMessageChunk(
      delta,
      rawResponse,
      defaultRole
    ) as AIMessageChunk;

    // Cast to xAI-specific types for proper typing
    const responseMetadata =
      messageChunk.response_metadata as XAIResponseMetadata;

    // Make concatenating chunks work without merge warning
    if (!rawResponse.choices[0]?.finish_reason) {
      delete responseMetadata.usage;
      delete messageChunk.usage_metadata;
    } else {
      messageChunk.usage_metadata = responseMetadata.usage;
    }
    return messageChunk;
  }

  protected override _convertCompletionsMessageToBaseMessage(
    message: OpenAIClient.ChatCompletionMessage & {
      reasoning_content?: string;
    },
    rawResponse: OpenAIClient.ChatCompletion
  ): AIMessageChunk {
    const langChainMessage = super._convertCompletionsMessageToBaseMessage(
      message,
      rawResponse
    ) as AIMessageChunk;

    // Cast additional_kwargs to xAI-specific type and add reasoning_content
    const additionalKwargs =
      langChainMessage.additional_kwargs as XAIAdditionalKwargs;
    additionalKwargs.reasoning_content = message.reasoning_content;

    return langChainMessage;
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
   * const model = new ChatXAI({ model: "grok-beta" });
   * const profile = model.profile;
   * console.log(profile.maxInputTokens); // 128000
   * console.log(profile.imageInputs); // true
   * ```
   */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  override withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  override withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  override withStructuredOutput<
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

  override withStructuredOutput<
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
      > {
    const ensuredConfig = { ...config };
    if (ensuredConfig?.method === undefined) {
      ensuredConfig.method = "functionCalling";
    }
    return super.withStructuredOutput<RunOutput>(outputSchema, ensuredConfig);
  }
}
