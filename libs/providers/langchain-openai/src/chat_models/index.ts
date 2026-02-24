import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessageChunk, isAIMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { type BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { Runnable } from "@langchain/core/runnables";
import { type OpenAICallOptions, type OpenAIChatInput } from "../types.js";
import {
  _convertToOpenAITool,
  isBuiltInTool,
  isCustomTool,
  isOpenAICustomTool,
} from "../utils/tools.js";
import { _modelPrefersResponsesAPI } from "../utils/misc.js";
import { _convertOpenAIResponsesUsageToLangChainUsage } from "../utils/output.js";
import {
  OpenAIWebSocketManager,
  type WebSocketRequest,
} from "../utils/websocket.js";
import {
  convertMessagesToResponsesInput,
  convertResponsesDeltaToChatGenerationChunk,
  convertResponsesMessageToAIMessage,
} from "../converters/responses.js";
import {
  ChatOpenAICompletions,
  ChatOpenAICompletionsCallOptions,
} from "./completions.js";
import {
  ChatOpenAIResponses,
  ChatOpenAIResponsesCallOptions,
} from "./responses.js";
import {
  BaseChatOpenAI,
  BaseChatOpenAIFields,
  getChatOpenAIModelParams,
} from "./base.js";

export type { OpenAICallOptions, OpenAIChatInput };

export type ChatOpenAICallOptions = ChatOpenAICompletionsCallOptions &
  ChatOpenAIResponsesCallOptions;

export interface ChatOpenAIFields extends BaseChatOpenAIFields {
  /**
   * Whether to use the responses API for all requests. If `false` the responses API will be used
   * only when required in order to fulfill the request.
   */
  useResponsesApi?: boolean;

  /**
   * Whether to use WebSocket transport for the Responses API. When enabled, a persistent
   * WebSocket connection is used instead of HTTP requests, which can reduce latency for
   * multiple sequential requests.
   *
   * Requires `useResponsesApi` to be `true` (or will automatically enable it).
   *
   * @default false
   * @see https://developers.openai.com/api/docs/guides/websocket-mode
   */
  useWebSocket?: boolean;

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
  CallOptions extends ChatOpenAICallOptions = ChatOpenAICallOptions,
> extends BaseChatOpenAI<CallOptions> {
  /**
   * Whether to use the responses API for all requests. If `false` the responses API will be used
   * only when required in order to fulfill the request.
   */
  useResponsesApi = false;

  /**
   * Whether to use WebSocket transport for the Responses API. When enabled, a persistent
   * WebSocket connection is used instead of HTTP requests, which can reduce latency for
   * multiple sequential requests.
   *
   * Requires `useResponsesApi` to be `true` (or will automatically enable it).
   *
   * @default false
   * @see https://developers.openai.com/api/docs/guides/websocket-mode
   */
  useWebSocket = false;

  protected wsManager: OpenAIWebSocketManager | null = null;

  protected responses: ChatOpenAIResponses;

  protected completions: ChatOpenAICompletions;

  get lc_serializable_keys(): string[] {
    return [...super.lc_serializable_keys, "useResponsesApi", "useWebSocket"];
  }

  get callKeys(): string[] {
    return [...super.callKeys, "useResponsesApi", "useWebSocket"];
  }

  protected fields?: ChatOpenAIFields;

  constructor(model: string, fields?: Omit<ChatOpenAIFields, "model">);
  constructor(fields?: ChatOpenAIFields);
  constructor(
    modelOrFields?: string | ChatOpenAIFields,
    fieldsArg?: Omit<ChatOpenAIFields, "model">
  ) {
    const fields = getChatOpenAIModelParams(modelOrFields, fieldsArg);
    super(fields);
    this.fields = fields;
    this.useResponsesApi = fields?.useResponsesApi ?? false;
    this.useWebSocket = fields?.useWebSocket ?? false;
    if (this.useWebSocket) {
      this.useResponsesApi = true;
    }
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
    const hasCustomTools =
      options?.tools?.some(isOpenAICustomTool) ||
      options?.tools?.some(isCustomTool);

    return (
      this.useResponsesApi ||
      this.useWebSocket ||
      usesBuiltInTools ||
      hasResponsesOnlyKwargs ||
      hasCustomTools ||
      _modelPrefersResponsesAPI(this.model)
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
      if (this.useWebSocket && !this.responses.invocationParams(options).stream) {
        return this._generateWebSocket(messages, options);
      }
      return this.responses._generate(messages, options, runManager);
    }
    return this.completions._generate(messages, options, runManager);
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    if (this._useResponsesApi(options)) {
      if (this.useWebSocket) {
        yield* this._streamResponseChunksWebSocket(
          messages,
          options,
          runManager
        );
        return;
      }
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

  /**
   * Get or lazily create the WebSocket manager for persistent connections to the
   * Responses API.
   */
  protected _getOrCreateWsManager(): OpenAIWebSocketManager {
    if (!this.wsManager) {
      this._getClientOptions(undefined);
      const baseURL = this.client
        ? (this.clientConfig.baseURL ?? "https://api.openai.com/v1")
        : "https://api.openai.com/v1";

      this.wsManager = new OpenAIWebSocketManager({
        apiKey: String(this.apiKey ?? ""),
        baseURL,
        organization: this.organization,
      });
    }
    return this.wsManager;
  }

  /**
   * Generate a response via WebSocket transport (non-streaming).
   */
  protected async _generateWebSocket(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<ChatResult> {
    const invocationParams = this.responses.invocationParams(options);
    const input = convertMessagesToResponsesInput({
      messages,
      zdrEnabled: this.zdrEnabled ?? false,
      model: this.model,
    });

    const requestBody = {
      input,
      ...invocationParams,
      stream: false,
    };

    const wsManager = this._getOrCreateWsManager();
    const data = await wsManager.invoke(
      requestBody as unknown as WebSocketRequest,
      options?.signal ?? undefined
    );

    return {
      generations: [
        {
          text: data.output_text,
          message: convertResponsesMessageToAIMessage(data),
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

  /**
   * Stream response chunks via WebSocket transport.
   */
  protected async *_streamResponseChunksWebSocket(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const lastAIMessage = messages.filter((m) => isAIMessage(m)).pop();
    const lastAIMessageId = lastAIMessage?.response_metadata?.id as
      | string
      | undefined;

    const request = {
      ...this.responses.invocationParams(options),
      input: convertMessagesToResponsesInput({
        messages,
        zdrEnabled: this.zdrEnabled ?? false,
        model: this.model,
      }),
      stream: true as const,
      ...(lastAIMessageId &&
      lastAIMessageId.startsWith("resp_") &&
      !this.zdrEnabled
        ? { previous_response_id: lastAIMessageId }
        : {}),
    };

    const wsManager = this._getOrCreateWsManager();

    for await (const data of wsManager.stream(
      request as unknown as WebSocketRequest,
      options.signal ?? undefined
    )) {
      const chunk = convertResponsesDeltaToChatGenerationChunk(data);
      if (chunk == null) continue;
      yield chunk;
    }
  }

  /**
   * Close the WebSocket connection if one exists.
   */
  closeWebSocket() {
    if (this.wsManager) {
      this.wsManager.close();
      this.wsManager = null;
    }
  }

  override withConfig(
    config: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    const newModel = new ChatOpenAI<CallOptions>(this.fields);
    newModel.defaultOptions = { ...this.defaultOptions, ...config };
    return newModel;
  }
}
