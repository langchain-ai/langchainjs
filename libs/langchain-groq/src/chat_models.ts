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
  FunctionMessageChunk,
  ToolMessageChunk,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { isZodSchema } from "@langchain/core/utils/types";
import Groq from "groq-sdk";
import type {
  ChatCompletion,
  ChatCompletionCreateParams,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import type { RequestOptions } from "groq-sdk/core";
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

type ChatGroqToolType = BindToolsInput | ChatCompletionTool;

/**
 * Const list of fields that we'll pick from the `ChatCompletionCreateParams` interface
 * to use as the options allowed to be passed to invocation methods.
 *
 * @internal
 */
const CREATE_PARAMS_BASE_CALL_KEYS = [
  // "messages", // passed as input arg to invocation methods
  // "model", // don't allow override on invoke
  "frequency_penalty",
  "function_call",
  "functions",
  "logit_bias", // not supported, but left in for forward compatibility
  "logprobs", // not supported, but left in for forward compatibility
  "max_completion_tokens",
  "max_tokens",
  "n", // not supported, but left in for forward compatibility
  "parallel_tool_calls",
  "presence_penalty",
  "reasoning_format",
  "response_format",
  "seed",
  // TODO: also pass as constructor arg
  "service_tier",
  "stop",
  // "stream", // determined by invocation method
  // other models only specify temperature as a constructor arg, but I don't see the harm in
  // allowing overrides on invocation
  "temperature",
  "tool_choice",
  // "tools", // need to allow users to specify langchain style tools, so we use a different type
  "top_logprobs",
  "top_p",
  // "user", // don't allow override on invoke
] as const;

const ADDED_CALL_KEYS = [
  "headers",
  "promptIndex",
  "stream_options",
  "tools",
] as const;

export type ChatGroqCallOptions = Pick<
  ChatCompletionsAPI.ChatCompletionCreateParamsBase,
  (typeof CREATE_PARAMS_BASE_CALL_KEYS)[number]
> &
  BaseChatModelCallOptions & {
    /**
     * Additional headers to pass to the API.
     */
    headers?: Record<string, string | null | undefined>;
    /**
     * The index of the prompt in the list of prompts.
     */
    promptIndex?: number;
    /**
     * Additional options to pass to streamed completions.
     * If provided takes precedence over "streamUsage" set at initialization time.
     */
    stream_options?: {
      /**
       * Whether or not to include token usage in the stream.
       * If set to `true`, this will include an additional
       * chunk at the end of the stream with the token usage.
       *
       * Defaults to `true` when streaming, `false` otherwise.
       */
      include_usage: boolean;
    };

    tools?: ChatGroqToolType[];

    // IMPORTANT: If you add a new key here you MUST add it to the `ADDED_CALL_KEYS`
    // list above. Keep this comment at the bottom so people see it when they go to
    // make additions.
  };

const ALL_CALL_KEYS: readonly (keyof ChatGroqCallOptions)[] = [
  ...CREATE_PARAMS_BASE_CALL_KEYS,
  ...ADDED_CALL_KEYS,
] as const;

/**
 * Timing details about the request, useful for collecting performance metrics.
 */
interface TimingMetadata {
  /**
   * Time spent generating tokens
   */
  completion_time?: number;

  /**
   * Time spent processing input tokens
   */
  prompt_time?: number;

  /**
   * Time the requests was spent queued
   */
  queue_time?: number;

  /**
   * completion time and prompt time combined
   */
  total_time?: number;
}
export interface ChatGroqInput extends BaseChatModelParams {
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

  /** Total probability mass of tokens to consider at each step */
  topP?: number;

  /** Penalizes repeated tokens according to frequency */
  frequencyPenalty?: number;

  /** Penalizes repeated tokens */
  presencePenalty?: number;

  /** Number of completions to generate for each prompt */
  n?: number;

  /** Dictionary used to adjust the probability of specific tokens being generated */
  logitBias?: Record<string, number>;

  /** Unique string identifier representing your end-user, which can help OpenAI to monitor and detect abuse. */
  user?: string;

  /**
   * Whether or not to include token usage data in streamed chunks.
   * @default true
   */
  streamUsage?: boolean;

  /**
   * Whether to return log probabilities of the output tokens or not.
   * If true, returns the log probabilities of each output token returned in the content of message.
   */
  logprobs?: boolean;

  /**
   * An integer between 0 and 5 specifying the number of most likely tokens to return at each token position,
   * each with an associated log probability. logprobs must be set to true if this parameter is used.
   */
  topLogprobs?: number;

  /**
   * The Groq API key to use for requests.
   * @default process.env.GROQ_API_KEY
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   */
  model: string;
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

function extractGenericMessageCustomRole(message: ChatMessage): GroqRoleEnum {
  if (
    message.role !== "system" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function"
  ) {
      console.warn(`Unknown message role: ${message.role}`);
  }
  return message.role as GroqRoleEnum;
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
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
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
  usageMetadata?: UsageMetadata,
  responseMetadata?: Record<string, unknown>
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
        response_metadata: responseMetadata,
      });
    }
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>,
  defaultRole: GroqRoleEnum | undefined,
  rawResponse: ChatCompletionsAPI.ChatCompletionChunk,
  lastMessageId: string | undefined
): BaseMessageChunk {
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
  if (delta.audio) {
    additional_kwargs.audio = {
      ...delta.audio,
      index: rawResponse.choices[0].index,
    };
  }

  let usage: UsageMetadata | undefined;
  let groqMessageId: string | undefined = lastMessageId;
  let timing: TimingMetadata | undefined;

  const xGroq = rawResponse.x_groq;
  if (xGroq?.usage) {
    usage = {
      input_tokens: xGroq.usage.prompt_tokens,
      output_tokens: xGroq.usage.completion_tokens,
      total_tokens: xGroq.usage.total_tokens,
    };
    timing = {
      completion_time: xGroq.usage.completion_time,
      prompt_time: xGroq.usage.prompt_time,
      queue_time: xGroq.usage.queue_time,
      total_time: xGroq.usage.total_time,
    };
  }

  if (xGroq?.id) {
    groqMessageId = xGroq.id;
  }

  const response_metadata = { usage, timing };
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
      id: groqMessageId,
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

/*
function _oldConvertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>,
  rawResponse: ChatCompletionsAPI.ChatCompletionChunk,
  index: number,
  defaultRole: GroqRoleEnum | undefined,
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
*/

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
 *   model: "llama-3.3-70b-versatile",
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

  model: string;

  temperature = 0.7;

  stop?: string[];

  stopSequences?: string[];

  maxTokens?: number;

  streaming = false;

  apiKey?: string;

  streamUsage: boolean = true;

  topP: number | null | undefined;

  frequencyPenalty: number | null | undefined;

  presencePenalty: number | null | undefined;

  logprobs: boolean | null | undefined;

  n: number | null | undefined;

  logitBias: Record<string, number> | null | undefined;

  user: string | null | undefined;

  reasoningFormat: ChatCompletionsAPI.ChatCompletionCreateParamsBase["reasoning_format"];

  serviceTier: ChatCompletionsAPI.ChatCompletionCreateParamsBase["service_tier"];

  topLogprobs: number | null | undefined;

  lc_serializable = true;

  get lc_serialized_keys(): string[] {
    return [
      "client",
      "model",
      "temperature",
      "stop",
      "stopSequences",
      "maxTokens",
      "streaming",
      "apiKey",
      "streamUsage",
      "topP",
      "frequencyPenalty",
      "presencePenalty",
      "logprobs",
      "n",
      "logitBias",
      "user",
      "reasoningFormat",
      "serviceTier",
      "topLogprobs",
    ];
  }

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

  get callKeys() {
    return [...super.callKeys, ...ALL_CALL_KEYS];
  }

  constructor(fields: ChatGroqInput) {
    super(fields);

    const apiKey = fields.apiKey || getEnvironmentVariable("GROQ_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Groq API key not found. Please set the GROQ_API_KEY environment variable or provide the key into "apiKey"`
      );
    }
    const defaultHeaders = {
      "User-Agent": "langchainjs",
      ...(fields.defaultHeaders ?? {}),
    };

    this.client = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
      baseURL: fields.baseUrl,
      timeout: fields.timeout,
      httpAgent: fields.httpAgent,
      fetch: fields.fetch,
      maxRetries: 0,
      defaultHeaders,
      defaultQuery: fields.defaultQuery,
    });
    this.apiKey = apiKey;
    this.temperature = fields.temperature ?? this.temperature;
    this.model = fields.model;
    this.streaming = fields.streaming ?? this.streaming;
    this.stop =
      fields.stopSequences ??
      (typeof fields.stop === "string" ? [fields.stop] : fields.stop) ??
      [];
    this.stopSequences = this.stop;
    this.maxTokens = fields.maxTokens;
    this.topP = fields.topP;
    this.frequencyPenalty = fields.frequencyPenalty;
    this.presencePenalty = fields.presencePenalty;
    this.logprobs = fields.logprobs;
    this.n = fields.n;
    this.logitBias = fields.logitBias;
    this.user = fields.user;
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
    options?: RequestOptions
  ): Promise<AsyncIterable<ChatCompletionsAPI.ChatCompletionChunk>>;

  async completionWithRetry(
    request: ChatCompletionCreateParamsNonStreaming,
    options?: RequestOptions
  ): Promise<ChatCompletion>;

  async completionWithRetry(
    request: ChatCompletionCreateParams,
    options?: RequestOptions
  ): Promise<
    AsyncIterable<ChatCompletionsAPI.ChatCompletionChunk> | ChatCompletion
  > {
    return this.caller.call(async () =>
      this.client.chat.completions.create(request, options)
    );
  }

  invocationParams(
    options: this["ParsedCallOptions"],
    extra?: { streaming?: boolean }
  ): Omit<ChatCompletionCreateParams, "messages"> {
    const params = super.invocationParams(options);

    let streamOptionsConfig = {};

    if (options?.stream_options !== undefined) {
      streamOptionsConfig = { stream_options: options.stream_options };
    } else if ((this.streamUsage && this.streaming) || extra?.streaming) {
      streamOptionsConfig = { stream_options: { include_usage: true } };
    }

    const toReturn: Omit<ChatCompletionCreateParams, "messages"> = {
      model: this.model,
      frequency_penalty: this.frequencyPenalty,
      function_call: options?.function_call,
      functions: options?.functions,
      logit_bias: this.logitBias,
      logprobs: this.logprobs,
      // max_completion_tokens
      // max_tokens
      n: this.n,
      parallel_tool_calls: options?.parallel_tool_calls,
      presence_penalty: this.presencePenalty,
      reasoning_format: this.reasoningFormat,
      response_format: options?.response_format,
      seed: options?.seed,
      service_tier: this.serviceTier,
      stop: options?.stop ?? this.stopSequences,
      temperature: options?.temperature ?? this.temperature,
      tool_choice: _formatToGroqToolChoice(options?.tool_choice),
      tools: options?.tools?.length
        ? options.tools.map((tool) => convertToOpenAITool(tool))
        : undefined,
      top_logprobs: this.topLogprobs,
      top_p: this.topP,
      user: this.user,
      // if include_usage is set or streamUsage then stream must be set to true.
      stream: this.streaming,
      ...params,
      ...streamOptionsConfig,
    };

    toReturn.max_completion_tokens =
      options?.max_completion_tokens ?? options?.max_tokens ?? this.maxTokens;
    if (toReturn.max_completion_tokens === -1) {
      delete toReturn.max_completion_tokens;
    }

    return toReturn;
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
    const params = this.invocationParams(options, { streaming: true });
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
    let role: GroqRoleEnum | undefined;
    let lastMessageId: string | undefined;

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
        role = choice.delta.role as GroqRoleEnum;
      }

      const chunk = _convertDeltaToMessageChunk(
        choice.delta,
        role,
        data,
        lastMessageId
      );
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
        // extract all fields from the response object except
        // choices to be included as response metadata
        const { choices: _choices, ...metadata } = data;

        const generation: ChatGeneration = {
          text,
          message: groqResponseToChatMessage(
            part.message ?? { role: "assistant" },
            usageMetadata,
            metadata
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

function _formatToGroqToolChoice(
  toolChoice?: string | ChatCompletionsAPI.ChatCompletionNamedToolChoice
):
  | ChatCompletionsAPI.ChatCompletionToolChoiceOption
  | Record<string, unknown>
  | null
  | undefined {
  if (!toolChoice) {
    return undefined;
  } else if (toolChoice === "any" || toolChoice === "required") {
    return "required";
  } else if (toolChoice === "auto") {
    return "auto";
  } else if (toolChoice === "none") {
    return "none";
  } else if (typeof toolChoice === "string") {
    return {
      type: "function",
      function: {
        name: toolChoice,
      },
    };
  } else {
    return toolChoice;
  }
}
