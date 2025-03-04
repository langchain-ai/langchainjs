import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BindToolsInput,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import * as ChatCompletionsAPI from "groq-sdk/resources/chat/completions";
import * as CompletionsAPI from "groq-sdk/resources/completions";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  HumanMessageChunk,
  SystemMessageChunk,
  ToolMessage,
  OpenAIToolCall,
  isAIMessage,
  BaseMessageChunk,
  UsageMetadata,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  type OpenAICoreRequestOptions,
  type OpenAIClient,
} from "@langchain/openai";
import { isZodSchema } from "@langchain/core/utils/types";
import Groq from "groq-sdk";
import {
  ChatCompletion,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  CompletionCreateParams,
} from "groq-sdk/resources/chat/completions";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  BaseLanguageModelInput,
  FunctionDefinition,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import {
  BaseLLMOutputParser,
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  JsonOutputKeyToolsParser,
  parseToolCall,
  makeInvalidToolCall,
  convertLangChainToolCallToOpenAI,
} from "@langchain/core/output_parsers/openai_tools";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { ToolCallChunk } from "@langchain/core/messages/tool";

type ChatGroqToolType = BindToolsInput | OpenAIClient.ChatCompletionTool;

export interface ChatGroqCallOptions extends BaseChatModelCallOptions {
  headers?: Record<string, string>;
  tools?: ChatGroqToolType[];
  tool_choice?: OpenAIClient.ChatCompletionToolChoiceOption | "any" | string;
  response_format?: CompletionCreateParams.ResponseFormat;
}

export interface ChatGroqInput extends BaseChatModelParams {
  /**
   * The Groq API key to use for requests.
   * @default process.env.GROQ_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * Alias for `model`
   * @default "mixtral-8x7b-32768"
   */
  modelName?: string;
  /**
   * The name of the model to use.
   * @default "mixtral-8x7b-32768"
   */
  model?: string;
  /**
   * Up to 4 sequences where the API will stop generating further tokens. The
   * returned text will not contain the stop sequence.
   * Alias for `stopSequences`
   */
  stop?: string | null | Array<string>;
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
   * Override the default base URL for the API
   */
  baseUrl?: string;
  /**
   * The maximum amount of time (in milliseconds) the client will wait for a response
   */
  timeout?: number;
  /**
   * HTTP agent used to manage connections
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  httpAgent?: any;
  /**
   * Custom fetch function implementation
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch?: (...args: any) => any;

  /**
   * Default headers included with every request
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Default query parameters included with every request
   */
  defaultQuery?: Record<string, string>;
}

type GroqRoleEnum = "system" | "assistant" | "user" | "function";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export function messageToGroqRole(message: BaseMessage): GroqRoleEnum {
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
      // Not yet supported as a type
      return "tool" as GroqRoleEnum;
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function convertMessagesToGroqParams(
  messages: BaseMessage[]
): Array<ChatCompletionsAPI.ChatCompletionMessage> {
  return messages.map((message): ChatCompletionsAPI.ChatCompletionMessage => {
    if (typeof message.content !== "string") {
      throw new Error("Non string message content not supported");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionParam: Record<string, any> = {
      role: messageToGroqRole(message),
      content: message.content,
      name: message.name,
      function_call: message.additional_kwargs.function_call,
      tool_calls: message.additional_kwargs.tool_calls,
      tool_call_id: (message as ToolMessage).tool_call_id,
    };
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
    } else {
      if (message.additional_kwargs.tool_calls != null) {
        completionParam.tool_calls = message.additional_kwargs.tool_calls;
      }
      if ((message as ToolMessage).tool_call_id != null) {
        completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
      }
    }
    return completionParam as ChatCompletionsAPI.ChatCompletionMessage;
  });
}

function groqResponseToChatMessage(
  message: ChatCompletionsAPI.ChatCompletionMessage,
  usageMetadata?: UsageMetadata
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
      return new AIMessage({
        content: message.content || "",
        additional_kwargs: { tool_calls: rawToolCalls },
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
        usage_metadata: usageMetadata,
      });
    }
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

function _convertDeltaToolCallToToolCallChunk(
  toolCalls?: ChatCompletionsAPI.ChatCompletionChunk.Choice.Delta.ToolCall[],
  index?: number
): ToolCallChunk[] | undefined {
  if (!toolCalls?.length) return undefined;

  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.function?.name,
    args: tc.function?.arguments,
    type: "tool_call_chunk",
    index,
  }));
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>,
  index: number,
  xGroq?: ChatCompletionsAPI.ChatCompletionChunk.XGroq
): {
  message: BaseMessageChunk;
  toolCallData?: {
    id: string;
    name: string;
    index: number;
    type: "tool_call_chunk";
  }[];
} {
  const { role } = delta;
  const content = delta.content ?? "";
  let additional_kwargs;
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

  let usageMetadata: UsageMetadata | undefined;
  let groqMessageId: string | undefined;
  if (xGroq?.usage) {
    usageMetadata = {
      input_tokens: xGroq.usage.prompt_tokens,
      output_tokens: xGroq.usage.completion_tokens,
      total_tokens: xGroq.usage.total_tokens,
    };
    groqMessageId = xGroq.id;
  }

  if (role === "user") {
    return {
      message: new HumanMessageChunk({ content }),
    };
  } else if (role === "assistant") {
    const toolCallChunks = _convertDeltaToolCallToToolCallChunk(
      delta.tool_calls,
      index
    );
    return {
      message: new AIMessageChunk({
        content,
        additional_kwargs,
        tool_call_chunks: toolCallChunks
          ? toolCallChunks.map((tc) => ({
              type: tc.type,
              args: tc.args,
              index: tc.index,
            }))
          : undefined,
        usage_metadata: usageMetadata,
        id: groqMessageId,
      }),
      toolCallData: toolCallChunks
        ? toolCallChunks.map((tc) => ({
            id: tc.id ?? "",
            name: tc.name ?? "",
            index: tc.index ?? index,
            type: "tool_call_chunk",
          }))
        : undefined,
    };
  } else if (role === "system") {
    return {
      message: new SystemMessageChunk({ content }),
    };
  } else {
    return {
      message: new ChatMessageChunk({ content, role }),
    };
  }
}

/**
 * Groq chat model integration.
 *
 * The Groq API is compatible to the OpenAI API with some limitations. View the
 * full API ref at:
 * @link {https://docs.api.groq.com/md/openai.oas.html}
 *
 * Setup:
 * Install `@langchain/groq` and set an environment variable named `GROQ_API_KEY`.
 *
 * ```bash
 * npm install @langchain/groq
 * export GROQ_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_groq.ChatGroq.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_groq.ChatGroqCallOptions.html)
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
 * import { ChatGroq } from '@langchain/groq';
 *
 * const llm = new ChatGroq({
 *   model: "mixtral-8x7b-32768",
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
 * const llmForToolCalling = new ChatGroq({
 *   model: "llama3-groq-70b-8192-tool-use-preview",
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
 */
export class ChatGroq extends BaseChatModel<
  ChatGroqCallOptions,
  AIMessageChunk
> {
  lc_namespace = ["langchain", "chat_models", "groq"];

  client: Groq;

  modelName = "mixtral-8x7b-32768";

  model = "mixtral-8x7b-32768";

  temperature = 0.7;

  stop?: string[];

  stopSequences?: string[];

  maxTokens?: number;

  streaming = false;

  apiKey?: string;

  static lc_name() {
    return "ChatGroq";
  }

  _llmType() {
    return "groq";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GROQ_API_KEY",
    };
  }

  lc_serializable = true;

  constructor(fields?: ChatGroqInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey || getEnvironmentVariable("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Groq API key not found. Please set the GROQ_API_KEY environment variable or provide the key into "apiKey"`
      );
    }
    const defaultHeaders = {
      "User-Agent": "langchainjs",
      ...(fields?.defaultHeaders ?? {}),
    };

    this.client = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
      baseURL: fields?.baseUrl,
      timeout: fields?.timeout,
      httpAgent: fields?.httpAgent,
      fetch: fields?.fetch,
      maxRetries: 0,
      defaultHeaders,
      defaultQuery: fields?.defaultQuery,
    });
    this.apiKey = apiKey;
    this.temperature = fields?.temperature ?? this.temperature;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.streaming = fields?.streaming ?? this.streaming;
    this.stop =
      fields?.stopSequences ??
      (typeof fields?.stop === "string" ? [fields.stop] : fields?.stop) ??
      [];
    this.stopSequences = this.stop;
    this.maxTokens = fields?.maxTokens;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "groq",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? this.temperature,
      ls_max_tokens: params.max_tokens ?? this.maxTokens,
      ls_stop: options.stop,
    };
  }

  async completionWithRetry(
    request: ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<ChatCompletionsAPI.ChatCompletionChunk>>;

  async completionWithRetry(
    request: ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<ChatCompletion>;

  async completionWithRetry(
    request: ChatCompletionCreateParams,
    options?: OpenAICoreRequestOptions
  ): Promise<
    AsyncIterable<ChatCompletionsAPI.ChatCompletionChunk> | ChatCompletion
  > {
    return this.caller.call(async () =>
      this.client.chat.completions.create(request, options)
    );
  }

  invocationParams(
    options: this["ParsedCallOptions"]
  ): ChatCompletionCreateParams {
    const params = super.invocationParams(options);
    if (options.tool_choice !== undefined) {
      params.tool_choice = options.tool_choice;
    }
    if (options.tools !== undefined) {
      params.tools = options.tools;
    }
    if (options.response_format !== undefined) {
      params.response_format = options.response_format;
    }
    return {
      ...params,
      stop: options.stop ?? this.stopSequences,
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
    };
  }

  override bindTools(
    tools: ChatGroqToolType[],
    kwargs?: Partial<ChatGroqCallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatGroqCallOptions> {
    return this.bind({
      tools: tools.map((tool) => convertToOpenAITool(tool)),
      ...kwargs,
    });
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToGroqParams(messages);
    const response = await this.completionWithRetry(
      {
        ...params,
        messages: messagesMapped,
        stream: true,
      },
      {
        signal: options?.signal,
        headers: options?.headers,
      }
    );
    let role = "";
    const toolCall: {
      id: string;
      name: string;
      index: number;
      type: "tool_call_chunk";
    }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let responseMetadata: Record<string, any> | undefined;
    for await (const data of response) {
      responseMetadata = data;
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      // The `role` field is populated in the first delta of the response
      // but is not present in subsequent deltas. Extract it when available.
      if (choice.delta?.role) {
        role = choice.delta.role;
      }

      const { message, toolCallData } = _convertDeltaToMessageChunk(
        {
          ...choice.delta,
          role,
        } ?? {},
        choice.index,
        data.x_groq
      );

      if (toolCallData) {
        // First, ensure the ID is not already present in toolCall
        const newToolCallData = toolCallData.filter((tc) =>
          toolCall.every((t) => t.id !== tc.id)
        );
        toolCall.push(...newToolCallData);

        // Yield here, ensuring the ID and name fields are only yielded once.
        yield new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: "",
            tool_call_chunks: newToolCallData,
          }),
          text: "",
        });
      }

      const chunk = new ChatGenerationChunk({
        message,
        text: choice.delta.content ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
        },
      });
      yield chunk;
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }

    if (responseMetadata) {
      if ("choices" in responseMetadata) {
        delete responseMetadata.choices;
      }
      yield new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          response_metadata: responseMetadata,
        }),
        text: "",
      });
    }

    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const tokenUsage: TokenUsage = {};
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      for await (const chunk of stream) {
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

      return { generations, llmOutput: { estimatedTokenUsage: tokenUsage } };
    } else {
      return this._generateNonStreaming(messages, options, runManager);
    }
  }

  async _generateNonStreaming(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const messagesMapped = convertMessagesToGroqParams(messages);

    const data = await this.completionWithRetry(
      {
        ...params,
        stream: false,
        messages: messagesMapped,
      },
      {
        signal: options?.signal,
        headers: options?.headers,
      }
    );

    if ("usage" in data && data.usage) {
      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
      } = data.usage as CompletionsAPI.CompletionUsage;

      if (completionTokens) {
        tokenUsage.completionTokens =
          (tokenUsage.completionTokens ?? 0) + completionTokens;
      }

      if (promptTokens) {
        tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + promptTokens;
      }

      if (totalTokens) {
        tokenUsage.totalTokens = (tokenUsage.totalTokens ?? 0) + totalTokens;
      }
    }

    const generations: ChatGeneration[] = [];

    if ("choices" in data && data.choices) {
      for (const part of (data as ChatCompletion).choices) {
        const text = part.message?.content ?? "";
        let usageMetadata: UsageMetadata | undefined;
        if (tokenUsage.totalTokens !== undefined) {
          usageMetadata = {
            input_tokens: tokenUsage.promptTokens ?? 0,
            output_tokens: tokenUsage.completionTokens ?? 0,
            total_tokens: tokenUsage.totalTokens,
          };
        }
        const generation: ChatGeneration = {
          text,
          message: groqResponseToChatMessage(
            part.message ?? { role: "assistant" },
            usageMetadata
          ),
        };
        generation.generationInfo = {
          ...(part.finish_reason ? { finish_reason: part.finish_reason } : {}),
          ...(part.logprobs ? { logprobs: part.logprobs } : {}),
        };
        generations.push(generation);
      }
    }

    return {
      generations,
      llmOutput: { tokenUsage },
    };
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

    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let llm: Runnable<BaseLanguageModelInput>;

    if (method === "jsonMode") {
      llm = this.bind({
        response_format: { type: "json_object" },
      });
      if (isZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      if (isZodSchema(schema)) {
        const asJsonSchema = zodToJsonSchema(schema);
        llm = this.bind({
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
        });
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
        llm = this.bind({
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
        });
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }
    }

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatGroqStructuredOutput",
      });
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
      runName: "ChatGroqStructuredOutput",
    });
  }
}
