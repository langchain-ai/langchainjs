import { Anthropic, type ClientOptions } from "@anthropic-ai/sdk";
import type { Stream } from "@anthropic-ai/sdk/streaming";

import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  type StructuredOutputMethodOptions,
  type BaseLanguageModelInput,
  isOpenAITool,
} from "@langchain/core/language_models/base";
import { zodToJsonSchema } from "zod-to-json-schema";
import { BaseLLMOutputParser } from "@langchain/core/output_parsers";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { isZodSchema } from "@langchain/core/utils/types";
import { z } from "zod";

import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { AnthropicToolsOutputParser } from "./output_parsers.js";
import { handleToolChoice } from "./utils/tools.js";
import { _convertMessagesToAnthropicPayload } from "./utils/message_inputs.js";
import {
  _makeMessageChunkFromAnthropicEvent,
  anthropicResponseToChatMessages,
} from "./utils/message_outputs.js";
import {
  AnthropicMessageCreateParams,
  AnthropicMessageStreamEvent,
  AnthropicRequestOptions,
  AnthropicStreamingMessageCreateParams,
  AnthropicThinkingConfigParam,
  AnthropicToolChoice,
  ChatAnthropicToolType,
} from "./types.js";
import { wrapAnthropicClientError } from "./utils/errors.js";

export interface ChatAnthropicCallOptions
  extends BaseChatModelCallOptions,
    Pick<AnthropicInput, "streamUsage"> {
  tools?: ChatAnthropicToolType[];
  /**
   * Whether or not to specify what tool the model should use
   * @default "auto"
   */
  tool_choice?: AnthropicToolChoice;
  /**
   * Custom headers to pass to the Anthropic API
   * when making a request.
   */
  headers?: Record<string, string>;
}

function _toolsInParams(
  params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
): boolean {
  return !!(params.tools && params.tools.length > 0);
}

function _documentsInParams(
  params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
): boolean {
  for (const message of params.messages ?? []) {
    if (typeof message.content === "string") {
      continue;
    }
    for (const block of message.content ?? []) {
      if (
        typeof block === "object" &&
        block != null &&
        block.type === "document" &&
        typeof block.citations === "object" &&
        block.citations.enabled
      ) {
        return true;
      }
    }
  }
  return false;
}

function _thinkingInParams(
  params: AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams
): boolean {
  return !!(params.thinking && params.thinking.type === "enabled");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAnthropicTool(tool: any): tool is Anthropic.Messages.Tool {
  return "input_schema" in tool;
}

/**
 * Input to AnthropicChat class.
 */
export interface AnthropicInput {
  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1. Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks.
   */
  temperature?: number;

  /** Only sample from the top K options for each subsequent
   * token. Used to remove "long tail" low probability
   * responses. Defaults to -1, which disables it.
   */
  topK?: number;

  /** Does nucleus sampling, in which we compute the
   * cumulative distribution over all the options for each
   * subsequent token in decreasing probability order and
   * cut it off once it reaches a particular probability
   * specified by top_p. Defaults to -1, which disables it.
   * Note that you should either alter temperature or top_p,
   * but not both.
   */
  topP?: number;

  /** A maximum number of tokens to generate before stopping. */
  maxTokens?: number;

  /**
   * A maximum number of tokens to generate before stopping.
   * @deprecated Use "maxTokens" instead.
   */
  maxTokensToSample?: number;

  /** A list of strings upon which to stop generating.
   * You probably want `["\n\nHuman:"]`, as that's the cue for
   * the next turn in the dialog agent.
   */
  stopSequences?: string[];

  /** Whether to stream the results or not */
  streaming?: boolean;

  /** Anthropic API key */
  anthropicApiKey?: string;
  /** Anthropic API key */
  apiKey?: string;

  /** Anthropic API URL */
  anthropicApiUrl?: string;

  /** @deprecated Use "model" instead */
  modelName?: string;
  /** Model name to use */
  model?: string;

  /** Overridable Anthropic ClientOptions */
  clientOptions?: ClientOptions;

  /** Holds any additional parameters that are valid to pass to {@link
   * https://console.anthropic.com/docs/api/reference |
   * `anthropic.messages`} that are not explicitly specified on this class.
   */
  invocationKwargs?: Kwargs;

  /**
   * Whether or not to include token usage data in streamed chunks.
   * @default true
   */
  streamUsage?: boolean;

  /**
   * Optional method that returns an initialized underlying Anthropic client.
   * Useful for accessing Anthropic models hosted on other cloud services
   * such as Google Vertex.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createClient?: (options: ClientOptions) => any;

  /**
   * Options for extended thinking.
   */
  thinking?: AnthropicThinkingConfigParam;
}

/**
 * A type representing additional parameters that can be passed to the
 * Anthropic API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

function extractToken(chunk: AIMessageChunk): string | undefined {
  if (typeof chunk.content === "string") {
    return chunk.content;
  } else if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "input" in chunk.content[0]
  ) {
    return typeof chunk.content[0].input === "string"
      ? chunk.content[0].input
      : JSON.stringify(chunk.content[0].input);
  } else if (
    Array.isArray(chunk.content) &&
    chunk.content.length >= 1 &&
    "text" in chunk.content[0]
  ) {
    return chunk.content[0].text;
  }
  return undefined;
}

/**
 * Anthropic chat model integration.
 *
 * Setup:
 * Install `@langchain/anthropic` and set an environment variable named `ANTHROPIC_API_KEY`.
 *
 * ```bash
 * npm install @langchain/anthropic
 * export ANTHROPIC_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_anthropic.ChatAnthropic.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_anthropic.ChatAnthropicCallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.bind`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.bind`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.bind({
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
 * import { ChatAnthropic } from '@langchain/anthropic';
 *
 * const llm = new ChatAnthropic({
 *   model: "claude-3-5-sonnet-20240620",
 *   temperature: 0,
 *   maxTokens: undefined,
 *   maxRetries: 2,
 *   // apiKey: "...",
 *   // baseUrl: "...",
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
 *   "id": "msg_01QDpd78JUHpRP6bRRNyzbW3",
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "response_metadata": {
 *     "id": "msg_01QDpd78JUHpRP6bRRNyzbW3",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null,
 *     "usage": {
 *       "input_tokens": 25,
 *       "output_tokens": 19
 *     },
 *     "type": "message",
 *     "role": "assistant"
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 19,
 *     "total_tokens": 44
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
 *   "id": "msg_01N8MwoYxiKo9w4chE4gXUs4",
 *   "content": "",
 *   "additional_kwargs": {
 *     "id": "msg_01N8MwoYxiKo9w4chE4gXUs4",
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620"
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 1,
 *     "total_tokens": 26
 *   }
 * }
 * AIMessageChunk {
 *   "content": "",
 * }
 * AIMessageChunk {
 *   "content": "Here",
 * }
 * AIMessageChunk {
 *   "content": "'s",
 * }
 * AIMessageChunk {
 *   "content": " the translation to",
 * }
 * AIMessageChunk {
 *   "content": " French:\n\nJ",
 * }
 * AIMessageChunk {
 *   "content": "'adore la programmation",
 * }
 * AIMessageChunk {
 *   "content": ".",
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 0,
 *     "output_tokens": 19,
 *     "total_tokens": 19
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
 *   "id": "msg_01SBTb5zSGXfjUc7yQ8EKEEA",
 *   "content": "Here's the translation to French:\n\nJ'adore la programmation.",
 *   "additional_kwargs": {
 *     "id": "msg_01SBTb5zSGXfjUc7yQ8EKEEA",
 *     "type": "message",
 *     "role": "assistant",
 *     "model": "claude-3-5-sonnet-20240620",
 *     "stop_reason": "end_turn",
 *     "stop_sequence": null
 *   },
 *   "usage_metadata": {
 *     "input_tokens": 25,
 *     "output_tokens": 20,
 *     "total_tokens": 45
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
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
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
 *     id: 'toolu_01WjW3Dann6BPJVtLhovdBD5',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_01G6wfJgqi5zRmJomsmkyZXe',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     id: 'toolu_0165qYWBA2VFyUst5RA18zew',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     id: 'toolu_01PGNyP33vxr13tGqr7i3rDo',
 *     type: 'tool_call'
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
 * const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 *
 * ```txt
 * {
 *   setup: "Why don't cats play poker in the jungle?",
 *   punchline: 'Too many cheetahs!',
 *   rating: 7
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
 * The weather in this image appears to be beautiful and clear. The sky is a vibrant blue with scattered white clouds, suggesting a sunny and pleasant day. The clouds are wispy and light, indicating calm conditions without any signs of storms or heavy weather. The bright green grass on the rolling hills looks lush and well-watered, which could mean recent rainfall or good growing conditions. Overall, the scene depicts a perfect spring or early summer day with mild temperatures, plenty of sunshine, and gentle breezes - ideal weather for enjoying the outdoors or for plant growth.
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
 * { input_tokens: 25, output_tokens: 19, total_tokens: 44 }
 * ```
 * </details>
 *
 * <br />
 *
 * <details>
 * <summary><strong>Stream Usage Metadata</strong></summary>
 *
 * ```typescript
 * const streamForMetadata = await llm.stream(
 *   input,
 *   {
 *     streamUsage: true
 *   }
 * );
 * let fullForMetadata: AIMessageChunk | undefined;
 * for await (const chunk of streamForMetadata) {
 *   fullForMetadata = !fullForMetadata ? chunk : concat(fullForMetadata, chunk);
 * }
 * console.log(fullForMetadata?.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 25, output_tokens: 20, total_tokens: 45 }
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
 *   id: 'msg_01STxeQxJmp4sCSpioD6vK3L',
 *   model: 'claude-3-5-sonnet-20240620',
 *   stop_reason: 'end_turn',
 *   stop_sequence: null,
 *   usage: { input_tokens: 25, output_tokens: 19 },
 *   type: 'message',
 *   role: 'assistant'
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatAnthropicMessages<
    CallOptions extends ChatAnthropicCallOptions = ChatAnthropicCallOptions
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements AnthropicInput
{
  static lc_name() {
    return "ChatAnthropic";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      anthropicApiKey: "ANTHROPIC_API_KEY",
      apiKey: "ANTHROPIC_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
    };
  }

  lc_serializable = true;

  anthropicApiKey?: string;

  apiKey?: string;

  apiUrl?: string;

  temperature = 1;

  topK = -1;

  topP = -1;

  maxTokens = 2048;

  modelName = "claude-3-7-sonnet-20250219";

  model = "claude-3-7-sonnet-20250219";

  invocationKwargs?: Kwargs;

  stopSequences?: string[];

  streaming = false;

  clientOptions: ClientOptions;

  thinking: AnthropicThinkingConfigParam = { type: "disabled" };

  // Used for non-streaming requests
  protected batchClient: Anthropic;

  // Used for streaming requests
  protected streamingClient: Anthropic;

  streamUsage = true;

  /**
   * Optional method that returns an initialized underlying Anthropic client.
   * Useful for accessing Anthropic models hosted on other cloud services
   * such as Google Vertex.
   */
  createClient: (options: ClientOptions) => Anthropic;

  constructor(fields?: AnthropicInput & BaseChatModelParams) {
    super(fields ?? {});

    this.anthropicApiKey =
      fields?.apiKey ??
      fields?.anthropicApiKey ??
      getEnvironmentVariable("ANTHROPIC_API_KEY");

    if (!this.anthropicApiKey && !fields?.createClient) {
      throw new Error("Anthropic API key not found");
    }
    this.clientOptions = fields?.clientOptions ?? {};
    /** Keep anthropicApiKey for backwards compatibility */
    this.apiKey = this.anthropicApiKey;

    // Support overriding the default API URL (i.e., https://api.anthropic.com)
    this.apiUrl = fields?.anthropicApiUrl;

    /** Keep modelName for backwards compatibility */
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;

    this.invocationKwargs = fields?.invocationKwargs ?? {};

    this.temperature = fields?.temperature ?? this.temperature;
    this.topK = fields?.topK ?? this.topK;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokens =
      fields?.maxTokensToSample ?? fields?.maxTokens ?? this.maxTokens;
    this.stopSequences = fields?.stopSequences ?? this.stopSequences;

    this.streaming = fields?.streaming ?? false;
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;

    this.thinking = fields?.thinking ?? this.thinking;

    this.createClient =
      fields?.createClient ??
      ((options: ClientOptions) => new Anthropic(options));
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "anthropic",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  /**
   * Formats LangChain StructuredTools to AnthropicTools.
   *
   * @param {ChatAnthropicCallOptions["tools"]} tools The tools to format
   * @returns {AnthropicTool[] | undefined} The formatted tools, or undefined if none are passed.
   */
  formatStructuredToolToAnthropic(
    tools: ChatAnthropicCallOptions["tools"]
  ): Anthropic.Messages.Tool[] | undefined {
    if (!tools || !tools.length) {
      return undefined;
    }
    return tools.map((tool) => {
      if (isAnthropicTool(tool)) {
        return tool;
      }
      if (isOpenAITool(tool)) {
        return {
          name: tool.function.name,
          description: tool.function.description,
          input_schema: tool.function
            .parameters as Anthropic.Messages.Tool.InputSchema,
        };
      }
      if (isLangChainTool(tool)) {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: zodToJsonSchema(
            tool.schema
          ) as Anthropic.Messages.Tool.InputSchema,
        };
      }
      throw new Error(
        `Unknown tool type passed to ChatAnthropic: ${JSON.stringify(
          tool,
          null,
          2
        )}`
      );
    });
  }

  override bindTools(
    tools: ChatAnthropicToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    return this.bind({
      tools: this.formatStructuredToolToAnthropic(tools),
      ...kwargs,
    } as Partial<CallOptions>);
  }

  /**
   * Get the parameters used to invoke the model
   */
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<
    AnthropicMessageCreateParams | AnthropicStreamingMessageCreateParams,
    "messages"
  > &
    Kwargs {
    const tool_choice:
      | Anthropic.Messages.ToolChoiceAuto
      | Anthropic.Messages.ToolChoiceAny
      | Anthropic.Messages.ToolChoiceTool
      | undefined = handleToolChoice(options?.tool_choice);

    if (this.thinking.type === "enabled") {
      if (this.topK !== -1) {
        throw new Error("topK is not supported when thinking is enabled");
      }
      if (this.topP !== -1) {
        throw new Error("topP is not supported when thinking is enabled");
      }
      if (this.temperature !== 1) {
        throw new Error(
          "temperature is not supported when thinking is enabled"
        );
      }

      return {
        model: this.model,
        stop_sequences: options?.stop ?? this.stopSequences,
        stream: this.streaming,
        max_tokens: this.maxTokens,
        tools: this.formatStructuredToolToAnthropic(options?.tools),
        tool_choice,
        thinking: this.thinking,
        ...this.invocationKwargs,
      };
    }
    return {
      model: this.model,
      temperature: this.temperature,
      top_k: this.topK,
      top_p: this.topP,
      stop_sequences: options?.stop ?? this.stopSequences,
      stream: this.streaming,
      max_tokens: this.maxTokens,
      tools: this.formatStructuredToolToAnthropic(options?.tools),
      tool_choice,
      thinking: this.thinking,
      ...this.invocationKwargs,
    };
  }

  /** @ignore */
  _identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const formattedMessages = _convertMessagesToAnthropicPayload(messages);
    const payload = {
      ...params,
      ...formattedMessages,
      stream: true,
    } as const;
    const coerceContentToString =
      !_toolsInParams(payload) &&
      !_documentsInParams(payload) &&
      !_thinkingInParams(payload);

    const stream = await this.createStreamWithRetry(payload, {
      headers: options.headers,
    });

    for await (const data of stream) {
      if (options.signal?.aborted) {
        stream.controller.abort();
        throw new Error("AbortError: User aborted the request.");
      }
      const shouldStreamUsage = this.streamUsage ?? options.streamUsage;
      const result = _makeMessageChunkFromAnthropicEvent(data, {
        streamUsage: shouldStreamUsage,
        coerceContentToString,
      });
      if (!result) continue;

      const { chunk } = result;

      // Extract the text content token for text field and runManager.
      const token = extractToken(chunk);
      const generationChunk = new ChatGenerationChunk({
        message: new AIMessageChunk({
          // Just yield chunk as it is and tool_use will be concat by BaseChatModel._generateUncached().
          content: chunk.content,
          additional_kwargs: chunk.additional_kwargs,
          tool_call_chunks: chunk.tool_call_chunks,
          usage_metadata: shouldStreamUsage ? chunk.usage_metadata : undefined,
          response_metadata: chunk.response_metadata,
          id: chunk.id,
        }),
        text: token ?? "",
      });
      yield generationChunk;

      await runManager?.handleLLMNewToken(
        token ?? "",
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
  }

  /** @ignore */
  async _generateNonStreaming(
    messages: BaseMessage[],
    params: Omit<
      | Anthropic.Messages.MessageCreateParamsNonStreaming
      | Anthropic.Messages.MessageCreateParamsStreaming,
      "messages"
    > &
      Kwargs,
    requestOptions: AnthropicRequestOptions
  ) {
    const response = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        ..._convertMessagesToAnthropicPayload(messages),
      },
      requestOptions
    );

    const { content, ...additionalKwargs } = response;

    const generations = anthropicResponseToChatMessages(
      content,
      additionalKwargs
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role: _role, type: _type, ...rest } = additionalKwargs;
    return { generations, llmOutput: rest };
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.stopSequences && options.stop) {
      throw new Error(
        `"stopSequence" parameter found in input and default params`
      );
    }

    const params = this.invocationParams(options);
    if (params.stream) {
      let finalChunk: ChatGenerationChunk | undefined;
      const stream = this._streamResponseChunks(messages, options, runManager);
      for await (const chunk of stream) {
        if (finalChunk === undefined) {
          finalChunk = chunk;
        } else {
          finalChunk = finalChunk.concat(chunk);
        }
      }
      if (finalChunk === undefined) {
        throw new Error("No chunks returned from Anthropic API.");
      }
      return {
        generations: [
          {
            text: finalChunk.text,
            message: finalChunk.message,
          },
        ],
      };
    } else {
      return this._generateNonStreaming(messages, params, {
        signal: options.signal,
        headers: options.headers,
      });
    }
  }

  /**
   * Creates a streaming request with retry.
   * @param request The parameters for creating a completion.
   * @param options
   * @returns A streaming request.
   */
  protected async createStreamWithRetry(
    request: AnthropicStreamingMessageCreateParams & Kwargs,
    options?: AnthropicRequestOptions
  ): Promise<Stream<AnthropicMessageStreamEvent>> {
    if (!this.streamingClient) {
      const options_ = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.streamingClient = this.createClient({
        dangerouslyAllowBrowser: true,
        ...this.clientOptions,
        ...options_,
        apiKey: this.apiKey,
        // Prefer LangChain built-in retries
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () => {
      try {
        return await this.streamingClient.messages.create(
          {
            ...request,
            ...this.invocationKwargs,
            stream: true,
          } as AnthropicStreamingMessageCreateParams,
          options
        );
      } catch (e) {
        const error = wrapAnthropicClientError(e);
        throw error;
      }
    };
    return this.caller.call(makeCompletionRequest);
  }

  /** @ignore */
  protected async completionWithRetry(
    request: AnthropicMessageCreateParams & Kwargs,
    options: AnthropicRequestOptions
  ): Promise<Anthropic.Message> {
    if (!this.batchClient) {
      const options = this.apiUrl ? { baseURL: this.apiUrl } : undefined;
      this.batchClient = this.createClient({
        dangerouslyAllowBrowser: true,
        ...this.clientOptions,
        ...options,
        apiKey: this.apiKey,
        maxRetries: 0,
      });
    }
    const makeCompletionRequest = async () => {
      try {
        return await this.batchClient.messages.create(
          {
            ...request,
            ...this.invocationKwargs,
          } as AnthropicMessageCreateParams,
          options
        );
      } catch (e) {
        const error = wrapAnthropicClientError(e);
        throw error;
      }
    };
    return this.caller.callWithOptions(
      { signal: options.signal ?? undefined },
      makeCompletionRequest
    );
  }

  _llmType() {
    return "anthropic";
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | z.ZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: z.ZodType<RunOutput> | Record<string, any> = outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(`Anthropic only supports "functionCalling" as a method.`);
    }

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let tools: Anthropic.Messages.Tool[];
    if (isZodSchema(schema)) {
      const jsonSchema = zodToJsonSchema(schema);
      tools = [
        {
          name: functionName,
          description:
            jsonSchema.description ?? "A function available to call.",
          input_schema: jsonSchema as Anthropic.Messages.Tool.InputSchema,
        },
      ];
      outputParser = new AnthropicToolsOutputParser({
        returnSingle: true,
        keyName: functionName,
        zodSchema: schema,
      });
    } else {
      let anthropicTools: Anthropic.Messages.Tool;
      if (
        typeof schema.name === "string" &&
        typeof schema.description === "string" &&
        typeof schema.input_schema === "object" &&
        schema.input_schema != null
      ) {
        anthropicTools = schema as Anthropic.Messages.Tool;
        functionName = schema.name;
      } else {
        anthropicTools = {
          name: functionName,
          description: schema.description ?? "",
          input_schema: schema as Anthropic.Messages.Tool.InputSchema,
        };
      }
      tools = [anthropicTools];
      outputParser = new AnthropicToolsOutputParser<RunOutput>({
        returnSingle: true,
        keyName: functionName,
      });
    }
    let llm;
    if (this.thinking?.type === "enabled") {
      const thinkingAdmonition =
        "Anthropic structured output relies on forced tool calling, " +
        "which is not supported when `thinking` is enabled. This method will raise " +
        "OutputParserException if tool calls are not " +
        "generated. Consider disabling `thinking` or adjust your prompt to ensure " +
        "the tool is called.";

      console.warn(thinkingAdmonition);

      llm = this.bind({
        tools,
      } as Partial<CallOptions>);

      const raiseIfNoToolCalls = (message: AIMessageChunk) => {
        if (!message.tool_calls || message.tool_calls.length === 0) {
          throw new Error(thinkingAdmonition);
        }
        return message;
      };

      llm = llm.pipe(raiseIfNoToolCalls);
    } else {
      llm = this.bind({
        tools,
        tool_choice: {
          type: "tool",
          name: functionName,
        },
      } as Partial<CallOptions>);
    }

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatAnthropicStructuredOutput",
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
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }
}

export class ChatAnthropic extends ChatAnthropicMessages {}
