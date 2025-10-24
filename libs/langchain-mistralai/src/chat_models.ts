import { v4 as uuidv4 } from "uuid";
import { Mistral as MistralClient } from "@mistralai/mistralai";
import {
  ChatCompletionRequest as MistralAIChatCompletionRequest,
  ChatCompletionRequestToolChoice as MistralAIToolChoice,
  Messages as MistralAIMessage,
} from "@mistralai/mistralai/models/components/chatcompletionrequest.js";
import { ContentChunk as MistralAIContentChunk } from "@mistralai/mistralai/models/components/contentchunk.js";
import { Tool as MistralAITool } from "@mistralai/mistralai/models/components/tool.js";
import { ToolCall as MistralAIToolCall } from "@mistralai/mistralai/models/components/toolcall.js";
import { ChatCompletionStreamRequest as MistralAIChatCompletionStreamRequest } from "@mistralai/mistralai/models/components/chatcompletionstreamrequest.js";
import { UsageInfo as MistralAITokenUsage } from "@mistralai/mistralai/models/components/usageinfo.js";
import { CompletionEvent as MistralAIChatCompletionEvent } from "@mistralai/mistralai/models/components/completionevent.js";
import { ChatCompletionResponse as MistralAIChatCompletionResponse } from "@mistralai/mistralai/models/components/chatcompletionresponse.js";
import {
  type BeforeRequestHook,
  type RequestErrorHook,
  type ResponseHook,
  HTTPClient as MistralAIHTTPClient,
} from "@mistralai/mistralai/lib/http.js";
import {
  BaseMessage,
  MessageType,
  MessageContent,
  MessageContentComplex,
  AIMessage,
  HumanMessage,
  HumanMessageChunk,
  AIMessageChunk,
  ToolMessageChunk,
  ChatMessageChunk,
  FunctionMessageChunk,
  isAIMessage,
} from "@langchain/core/messages";
import type {
  BaseLanguageModelInput,
  BaseLanguageModelCallOptions,
  StructuredOutputMethodOptions,
  FunctionDefinition,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
  BindToolsInput,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";

import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  type BaseLLMOutputParser,
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  JsonOutputKeyToolsParser,
  convertLangChainToolCallToOpenAI,
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
  RunnableBinding,
} from "@langchain/core/runnables";
import {
  JsonSchema7Type,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import { ToolCallChunk } from "@langchain/core/messages/tool";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  _convertToolCallIdToMistralCompatible,
  _mistralContentChunkToMessageContentComplex,
} from "./utils.js";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

type ChatMistralAIToolType = MistralAIToolCall | MistralAITool | BindToolsInput;

export interface ChatMistralAICallOptions
  extends Omit<BaseLanguageModelCallOptions, "stop"> {
  response_format?: {
    type: "text" | "json_object";
  };
  tools?: ChatMistralAIToolType[];
  tool_choice?: MistralAIToolChoice;
  /**
   * Whether or not to include token usage in the stream.
   * @default {true}
   */
  streamUsage?: boolean;
}

/**
 * Input to chat model class.
 */
export interface ChatMistralAIInput
  extends BaseChatModelParams,
    Pick<ChatMistralAICallOptions, "streamUsage"> {
  /**
   * The API key to use.
   * @default {process.env.MISTRAL_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * Alias for `model`
   * @deprecated Use `model` instead.
   * @default {"mistral-small-latest"}
   */
  modelName?: string;
  /**
   * The name of the model to use.
   * @default {"mistral-small-latest"}
   */
  model?: string;
  /**
   * Override the default server URL used by the Mistral SDK.
   * @deprecated use serverURL instead
   */
  endpoint?: string;
  /**
   * Override the default server URL used by the Mistral SDK.
   */
  serverURL?: string;
  /**
   * What sampling temperature to use, between 0.0 and 2.0.
   * Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
   * @default {0.7}
   */
  temperature?: number;
  /**
   * Nucleus sampling, where the model considers the results of the tokens with `top_p` probability mass.
   * So 0.1 means only the tokens comprising the top 10% probability mass are considered.
   * Should be between 0 and 1.
   * @default {1}
   */
  topP?: number;
  /**
   * The maximum number of tokens to generate in the completion.
   * The token count of your prompt plus max_tokens cannot exceed the model's context length.
   */
  maxTokens?: number;
  /**
   * Whether or not to stream the response.
   * @default {false}
   */
  streaming?: boolean;
  /**
   * Whether to inject a safety prompt before all conversations.
   * @default {false}
   * @deprecated use safePrompt instead
   */
  safeMode?: boolean;
  /**
   * Whether to inject a safety prompt before all conversations.
   * @default {false}
   */
  safePrompt?: boolean;
  /**
   * The seed to use for random sampling. If set, different calls will generate deterministic results.
   * Alias for `seed`
   */
  randomSeed?: number;
  /**
   * The seed to use for random sampling. If set, different calls will generate deterministic results.
   */
  seed?: number;
  /**
   * A list of custom hooks that must follow (req: Request) => Awaitable<Request | void>
   * They are automatically added when a ChatMistralAI instance is created.
   */
  beforeRequestHooks?: BeforeRequestHook[];
  /**
   * A list of custom hooks that must follow (err: unknown, req: Request) => Awaitable<void>.
   * They are automatically added when a ChatMistralAI instance is created.
   */
  requestErrorHooks?: RequestErrorHook[];
  /**
   * A list of custom hooks that must follow (res: Response, req: Request) => Awaitable<void>.
   * They are automatically added when a ChatMistralAI instance is created.
   */
  responseHooks?: ResponseHook[];
  /**
   * Custom HTTP client to manage API requests.
   * Allows users to add custom fetch implementations, hooks, as well as error and response processing.
   */
  httpClient?: MistralAIHTTPClient;
  /**
   * Determines how much the model penalizes the repetition of words or phrases. A higher presence
   * penalty encourages the model to use a wider variety of words and phrases, making the output
   * more diverse and creative.
   */
  presencePenalty?: number;
  /**
   * Penalizes the repetition of words based on their frequency in the generated text. A higher
   * frequency penalty discourages the model from repeating words that have already appeared frequently
   * in the output, promoting diversity and reducing repetition.
   */
  frequencyPenalty?: number;
  /**
   * Number of completions to return for each request, input tokens are only billed once.
   */
  numCompletions?: number;
}

function convertMessagesToMistralMessages(
  messages: Array<BaseMessage>
): Array<MistralAIMessage> {
  const getRole = (role: MessageType) => {
    switch (role) {
      case "human":
        return "user";
      case "ai":
        return "assistant";
      case "system":
        return "system";
      case "tool":
        return "tool";
      case "function":
        return "assistant";
      default:
        throw new Error(`Unknown message type: ${role}`);
    }
  };

  const getContent = (
    content: MessageContent,
    type: MessageType
  ): string | MistralAIContentChunk[] => {
    const _generateContentChunk = (
      complex: MessageContentComplex,
      role: string
    ): MistralAIContentChunk => {
      if (
        complex.type === "image_url" &&
        (role === "user" || role === "assistant")
      ) {
        return {
          type: complex.type,
          imageUrl: complex?.image_url,
        };
      }

      if (complex.type === "text") {
        return {
          type: complex.type,
          text: complex?.text,
        };
      }

      throw new Error(
        `ChatMistralAI only supports messages of "image_url" for roles "user" and "assistant", and "text" for all others.\n\nReceived: ${JSON.stringify(
          content,
          null,
          2
        )}`
      );
    };

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      const mistralRole = getRole(type);
      // Mistral "assistant" and "user" roles can support Mistral ContentChunks
      // Mistral "system" role can support Mistral TextChunks
      const newContent: MistralAIContentChunk[] = [];
      content.forEach((messageContentComplex) => {
        // Mistral content chunks only support type "text" and "image_url"
        if (
          messageContentComplex.type === "text" ||
          messageContentComplex.type === "image_url"
        ) {
          newContent.push(
            _generateContentChunk(messageContentComplex, mistralRole)
          );
        } else {
          throw new Error(
            `Mistral only supports types "text" or "image_url" for complex message types.`
          );
        }
      });
      return newContent;
    }

    throw new Error(
      `Message content must be a string or an array.\n\nReceived: ${JSON.stringify(
        content,
        null,
        2
      )}`
    );
  };

  const getTools = (message: BaseMessage): MistralAIToolCall[] | undefined => {
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      return message.tool_calls
        .map((toolCall) => ({
          ...toolCall,
          id: _convertToolCallIdToMistralCompatible(toolCall.id ?? ""),
        }))
        .map(convertLangChainToolCallToOpenAI) as MistralAIToolCall[];
    }
    return undefined;
  };

  return messages.map((message) => {
    const toolCalls = getTools(message);
    const content = getContent(message.content, message.getType());
    if ("tool_call_id" in message && typeof message.tool_call_id === "string") {
      return {
        role: getRole(message.getType()),
        content,
        name: message.name,
        toolCallId: _convertToolCallIdToMistralCompatible(message.tool_call_id),
      };
      // Mistral "assistant" role can only support either content or tool calls but not both
    } else if (isAIMessage(message)) {
      if (toolCalls === undefined) {
        return {
          role: getRole(message.getType()),
          content,
        };
      } else {
        return {
          role: getRole(message.getType()),
          toolCalls,
        };
      }
    }

    return {
      role: getRole(message.getType()),
      content,
    };
  }) as MistralAIMessage[];
}

function mistralAIResponseToChatMessage(
  choice: NonNullable<MistralAIChatCompletionResponse["choices"]>[0],
  usage?: MistralAITokenUsage
): BaseMessage {
  const { message } = choice;
  if (message === undefined) {
    throw new Error("No message found in response");
  }
  // MistralAI SDK does not include toolCalls in the non
  // streaming return type, so we need to extract it like this
  // to satisfy typescript.
  let rawToolCalls: MistralAIToolCall[] = [];
  if ("toolCalls" in message && Array.isArray(message.toolCalls)) {
    rawToolCalls = message.toolCalls;
  }
  const content = _mistralContentChunkToMessageContentComplex(message.content);
  switch (message.role) {
    case "assistant": {
      const toolCalls = [];
      const invalidToolCalls = [];
      for (const rawToolCall of rawToolCalls) {
        try {
          const parsed = parseToolCall(rawToolCall, { returnId: true });
          toolCalls.push({
            ...parsed,
            id: parsed.id ?? uuidv4().replace(/-/g, ""),
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          invalidToolCalls.push(makeInvalidToolCall(rawToolCall, e.message));
        }
      }
      return new AIMessage({
        content,
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
        additional_kwargs: {},
        usage_metadata: usage
          ? {
              input_tokens: usage.promptTokens,
              output_tokens: usage.completionTokens,
              total_tokens: usage.totalTokens,
            }
          : undefined,
      });
    }
    default:
      return new HumanMessage({ content });
  }
}

function _convertDeltaToMessageChunk(
  delta: {
    role?: string | null | undefined;
    content?: string | MistralAIContentChunk[] | null | undefined;
    toolCalls?: MistralAIToolCall[] | null | undefined;
  },
  usage?: MistralAITokenUsage | null
) {
  if (!delta.content && !delta.toolCalls) {
    if (usage) {
      return new AIMessageChunk({
        content: "",
        usage_metadata: usage
          ? {
              input_tokens: usage.promptTokens,
              output_tokens: usage.completionTokens,
              total_tokens: usage.totalTokens,
            }
          : undefined,
      });
    }
    return null;
  }
  // Our merge additional kwargs util function will throw unless there
  // is an index key in each tool object (as seen in OpenAI's) so we
  // need to insert it here.
  const rawToolCallChunksWithIndex = delta.toolCalls?.length
    ? delta.toolCalls?.map(
        (toolCall, index): MistralAIToolCall & { index: number } => ({
          ...toolCall,
          index,
          id: toolCall.id ?? uuidv4().replace(/-/g, ""),
          type: "function",
        })
      )
    : undefined;

  let role = "assistant";
  if (delta.role) {
    role = delta.role;
  }
  const content = _mistralContentChunkToMessageContentComplex(delta.content);

  let additional_kwargs;
  const toolCallChunks: ToolCallChunk[] = [];
  if (rawToolCallChunksWithIndex !== undefined) {
    for (const rawToolCallChunk of rawToolCallChunksWithIndex) {
      const rawArgs = rawToolCallChunk.function?.arguments;
      const args =
        rawArgs === undefined || typeof rawArgs === "string"
          ? rawArgs
          : JSON.stringify(rawArgs);
      toolCallChunks.push({
        name: rawToolCallChunk.function?.name,
        args,
        id: rawToolCallChunk.id,
        index: rawToolCallChunk.index,
        type: "tool_call_chunk",
      });
    }
  } else {
    additional_kwargs = {};
  }

  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({
      content,
      tool_call_chunks: toolCallChunks,
      additional_kwargs,
      usage_metadata: usage
        ? {
            input_tokens: usage.promptTokens,
            output_tokens: usage.completionTokens,
            total_tokens: usage.totalTokens,
          }
        : undefined,
    });
  } else if (role === "tool") {
    return new ToolMessageChunk({
      content,
      additional_kwargs,
      tool_call_id: rawToolCallChunksWithIndex?.[0].id ?? "",
    });
  } else if (role === "function") {
    return new FunctionMessageChunk({
      content,
      additional_kwargs,
    });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

function _convertToolToMistralTool(
  tools: ChatMistralAIToolType[]
): MistralAITool[] | undefined {
  if (!tools || !tools.length) {
    return undefined;
  }
  return tools.map((tool) => {
    // If already a MistralAITool with a 'function' property, return as is
    if ("function" in tool) {
      return {
        type: tool.type ?? "function",
        function: tool.function,
      };
    }

    // If it's a LangChain tool, convert to MistralAITool
    if (isLangChainTool(tool)) {
      const description = tool.description ?? `Tool: ${tool.name}`;
      return {
        type: "function",
        function: {
          name: tool.name,
          description,
          parameters: isInteropZodSchema(tool.schema)
            ? toJsonSchema(tool.schema)
            : tool.schema,
        },
      };
    }

    throw new Error(
      `Unknown tool type passed to ChatMistral: ${JSON.stringify(
        tool,
        null,
        2
      )}`
    );
  });
}

/**
 * Mistral AI chat model integration.
 *
 * Setup:
 * Install `@langchain/mistralai` and set an environment variable named `MISTRAL_API_KEY`.
 *
 * ```bash
 * npm install @langchain/mistralai
 * export MISTRAL_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/_langchain_mistralai.ChatMistralAI.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/_langchain_mistralai.ChatMistralAICallOptions.html)
 *
 * Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
 * They can also be passed via `.withConfig`, or the second arg in `.bindTools`, like shown in the examples below:
 *
 * ```typescript
 * // When calling `.withConfig`, call options should be passed via the first argument
 * const llmWithArgsBound = llm.bindTools([...]) // tools array
 *   .withConfig({
 *     stop: ["\n"], // other call options
 *   });
 *
 * // You can also bind tools and call options like this
 * const llmWithTools = llm.bindTools([...], {
 *   tool_choice: "auto",
 * });
 * ```
 *
 * ## Examples
 *
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 *
 * ```typescript
 * import { ChatMistralAI } from '@langchain/mistralai';
 *
 * const llm = new ChatMistralAI({
 *   model: "mistral-large-2402",
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
 *   "content": "The translation of \"I love programming\" into French is \"J'aime la programmation\". Here's the breakdown:\n\n- \"I\" translates to \"Je\"\n- \"love\" translates to \"aime\"\n- \"programming\" translates to \"la programmation\"\n\nSo, \"J'aime la programmation\" means \"I love programming\" in French.",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "tokenUsage": {
 *       "completionTokens": 89,
 *       "promptTokens": 13,
 *       "totalTokens": 102
 *     },
 *     "finish_reason": "stop"
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 13,
 *     "output_tokens": 89,
 *     "total_tokens": 102
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
 *   "content": "The",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " translation",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " of",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " \"",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "I",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *  "content": ".",
 *  "additional_kwargs": {},
 *  "response_metadata": {
 *    "prompt": 0,
 *    "completion": 0
 *  },
 *  "tool_calls": [],
 *  "tool_call_chunks": [],
 *  "invalid_tool_calls": []
 *}
 *AIMessageChunk {
 *  "content": "",
 *  "additional_kwargs": {},
 *  "response_metadata": {
 *    "prompt": 0,
 *    "completion": 0
 *  },
 *  "tool_calls": [],
 *  "tool_call_chunks": [],
 *  "invalid_tool_calls": [],
 *  "usage_metadata": {
 *    "input_tokens": 13,
 *    "output_tokens": 89,
 *    "total_tokens": 102
 *  }
 *}
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
 *   "content": "The translation of \"I love programming\" into French is \"J'aime la programmation\". Here's the breakdown:\n\n- \"I\" translates to \"Je\"\n- \"love\" translates to \"aime\"\n- \"programming\" translates to \"la programmation\"\n\nSo, \"J'aime la programmation\" means \"I love programming\" in French.",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "prompt": 0,
 *     "completion": 0
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 13,
 *     "output_tokens": 89,
 *     "total_tokens": 102
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
 *     type: 'tool_call',
 *     id: '47i216yko'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'nb3v8Fpcn'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'Los Angeles, CA' },
 *     type: 'tool_call',
 *     id: 'EedWzByIB'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'New York, NY' },
 *     type: 'tool_call',
 *     id: 'jLdLia7zC'
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
 * <summary><strong>Usage Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(input);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 13, output_tokens: 89, total_tokens: 102 }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatMistralAI<
    CallOptions extends ChatMistralAICallOptions = ChatMistralAICallOptions
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements ChatMistralAIInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatMistralAI";
  }

  lc_namespace = ["langchain", "chat_models", "mistralai"];

  model = "mistral-small-latest";

  apiKey: string;

  /**
   * @deprecated use serverURL instead
   */
  endpoint: string;

  serverURL?: string;

  temperature = 0.7;

  streaming = false;

  topP = 1;

  maxTokens: number;

  /**
   * @deprecated use safePrompt instead
   */
  safeMode = false;

  safePrompt = false;

  randomSeed?: number;

  seed?: number;

  maxRetries?: number;

  lc_serializable = true;

  streamUsage = true;

  beforeRequestHooks?: Array<BeforeRequestHook>;

  requestErrorHooks?: Array<RequestErrorHook>;

  responseHooks?: Array<ResponseHook>;

  httpClient?: MistralAIHTTPClient;

  presencePenalty?: number;

  frequencyPenalty?: number;

  numCompletions?: number;

  constructor(fields?: ChatMistralAIInput) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("MISTRAL_API_KEY");
    if (!apiKey) {
      throw new Error(
        "API key MISTRAL_API_KEY is missing for MistralAI, but it is required."
      );
    }
    this.apiKey = apiKey;
    this.streaming = fields?.streaming ?? this.streaming;
    this.serverURL = fields?.serverURL ?? this.serverURL;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.safePrompt = fields?.safePrompt ?? this.safePrompt;
    this.randomSeed = fields?.seed ?? fields?.randomSeed ?? this.seed;
    this.seed = this.randomSeed;
    this.maxRetries = fields?.maxRetries;
    this.httpClient = fields?.httpClient;
    this.model = fields?.model ?? fields?.modelName ?? this.model;
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
    this.beforeRequestHooks =
      fields?.beforeRequestHooks ?? this.beforeRequestHooks;
    this.requestErrorHooks =
      fields?.requestErrorHooks ?? this.requestErrorHooks;
    this.responseHooks = fields?.responseHooks ?? this.responseHooks;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.numCompletions = fields?.numCompletions ?? this.numCompletions;
    this.addAllHooksToHttpClient();
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "MISTRAL_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "mistral_api_key",
    };
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "mistral",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.maxTokens ?? undefined,
    };
  }

  _llmType() {
    return "mistral_ai";
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<
    MistralAIChatCompletionRequest | MistralAIChatCompletionStreamRequest,
    "messages"
  > {
    const { response_format, tools, tool_choice } = options ?? {};
    const mistralAITools: Array<MistralAITool> | undefined = tools?.length
      ? _convertToolToMistralTool(tools)
      : undefined;
    const params: Omit<MistralAIChatCompletionRequest, "messages"> = {
      model: this.model,
      tools: mistralAITools,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      topP: this.topP,
      randomSeed: this.seed,
      safePrompt: this.safePrompt,
      toolChoice: tool_choice,
      responseFormat: response_format,
      presencePenalty: this.presencePenalty,
      frequencyPenalty: this.frequencyPenalty,
      n: this.numCompletions,
    };
    return params;
  }

  override bindTools(
    tools: ChatMistralAIToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    const mistralTools = _convertToolToMistralTool(tools);
    return new RunnableBinding({
      bound: this,
      kwargs: {
        ...(kwargs ?? {}),
        tools: mistralTools,
      } as Partial<CallOptions>,
      config: {},
    });
  }

  /**
   * Calls the MistralAI API with retry logic in case of failures.
   * @param {ChatRequest} input The input to send to the MistralAI API.
   * @returns {Promise<MistralAIChatCompletionResult | AsyncIterable<MistralAIChatCompletionEvent>>} The response from the MistralAI API.
   */
  async completionWithRetry(
    input: MistralAIChatCompletionStreamRequest,
    streaming: true
  ): Promise<AsyncIterable<MistralAIChatCompletionEvent>>;

  async completionWithRetry(
    input: MistralAIChatCompletionRequest,
    streaming: false
  ): Promise<MistralAIChatCompletionResponse>;

  async completionWithRetry(
    input:
      | MistralAIChatCompletionRequest
      | MistralAIChatCompletionStreamRequest,
    streaming: boolean
  ): Promise<
    | MistralAIChatCompletionResponse
    | AsyncIterable<MistralAIChatCompletionEvent>
  > {
    const caller = new AsyncCaller({
      maxRetries: this.maxRetries,
    });
    const client = new MistralClient({
      apiKey: this.apiKey,
      serverURL: this.serverURL,
      // If httpClient exists, pass it into constructor
      ...(this.httpClient ? { httpClient: this.httpClient } : {}),
    });

    return caller.call(async () => {
      try {
        let res:
          | MistralAIChatCompletionResponse
          | AsyncIterable<MistralAIChatCompletionEvent>;
        if (streaming) {
          res = await client.chat.stream(input);
        } else {
          res = await client.chat.complete(input);
        }
        return res;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (
          e.message?.includes("status: 400") ||
          e.message?.toLowerCase().includes("status 400") ||
          e.message?.includes("validation failed")
        ) {
          e.status = 400;
        }
        throw e;
      }
    });
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const mistralMessages = convertMessagesToMistralMessages(messages);
    const input = {
      ...params,
      messages: mistralMessages,
    };

    // Enable streaming for signal controller or timeout due
    // to SDK limitations on canceling requests.
    const shouldStream = options.signal ?? !!options.timeout;

    // Handle streaming
    if (this.streaming || shouldStream) {
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
    }

    // Not streaming, so we can just call the API once.
    const response = await this.completionWithRetry(input, false);

    const { completionTokens, promptTokens, totalTokens } =
      response?.usage ?? {};

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

    const generations: ChatGeneration[] = [];
    for (const part of response?.choices ?? []) {
      if ("delta" in part) {
        throw new Error("Delta not supported in non-streaming mode.");
      }
      if (!("message" in part)) {
        throw new Error("No message found in the choice.");
      }
      let text = part.message?.content ?? "";
      if (Array.isArray(text)) {
        text = text[0].type === "text" ? text[0].text : "";
      }
      const generation: ChatGeneration = {
        text,
        message: mistralAIResponseToChatMessage(part, response?.usage),
      };
      if (part.finishReason) {
        generation.generationInfo = { finishReason: part.finishReason };
      }
      generations.push(generation);
    }
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const mistralMessages = convertMessagesToMistralMessages(messages);
    const params = this.invocationParams(options);
    const input = {
      ...params,
      messages: mistralMessages,
    };

    const streamIterable = await this.completionWithRetry(input, true);
    for await (const { data } of streamIterable) {
      if (options.signal?.aborted) {
        throw new Error("AbortError");
      }
      const choice = data?.choices[0];
      if (!choice || !("delta" in choice)) {
        continue;
      }

      const { delta } = choice;
      if (!delta) {
        continue;
      }
      const newTokenIndices = {
        prompt: 0,
        completion: choice.index ?? 0,
      };
      const shouldStreamUsage = this.streamUsage || options.streamUsage;
      const message = _convertDeltaToMessageChunk(
        delta,
        shouldStreamUsage ? data.usage : null
      );
      if (message === null) {
        // Do not yield a chunk if the message is empty
        continue;
      }
      let text = delta.content ?? "";
      if (Array.isArray(text)) {
        text = text[0].type === "text" ? text[0].text : "";
      }
      const generationChunk = new ChatGenerationChunk({
        message,
        text,
        generationInfo: newTokenIndices,
      });
      yield generationChunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
  }

  addAllHooksToHttpClient() {
    try {
      // To prevent duplicate hooks
      this.removeAllHooksFromHttpClient();

      // If the user wants to use hooks, but hasn't created an HTTPClient yet
      const hasHooks = [
        this.beforeRequestHooks,
        this.requestErrorHooks,
        this.responseHooks,
      ].some((hook) => hook && hook.length > 0);
      if (hasHooks && !this.httpClient) {
        this.httpClient = new MistralAIHTTPClient();
      }

      if (this.beforeRequestHooks) {
        for (const hook of this.beforeRequestHooks) {
          this.httpClient?.addHook("beforeRequest", hook);
        }
      }

      if (this.requestErrorHooks) {
        for (const hook of this.requestErrorHooks) {
          this.httpClient?.addHook("requestError", hook);
        }
      }

      if (this.responseHooks) {
        for (const hook of this.responseHooks) {
          this.httpClient?.addHook("response", hook);
        }
      }
    } catch {
      throw new Error("Error in adding all hooks");
    }
  }

  removeAllHooksFromHttpClient() {
    try {
      if (this.beforeRequestHooks) {
        for (const hook of this.beforeRequestHooks) {
          this.httpClient?.removeHook("beforeRequest", hook);
        }
      }

      if (this.requestErrorHooks) {
        for (const hook of this.requestErrorHooks) {
          this.httpClient?.removeHook("requestError", hook);
        }
      }

      if (this.responseHooks) {
        for (const hook of this.responseHooks) {
          this.httpClient?.removeHook("response", hook);
        }
      }
    } catch {
      throw new Error("Error in removing hooks");
    }
  }

  removeHookFromHttpClient(
    hook: BeforeRequestHook | RequestErrorHook | ResponseHook
  ) {
    try {
      this.httpClient?.removeHook("beforeRequest", hook as BeforeRequestHook);
      this.httpClient?.removeHook("requestError", hook as RequestErrorHook);
      this.httpClient?.removeHook("response", hook as ResponseHook);
    } catch {
      throw new Error("Error in removing hook");
    }
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
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
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: InteropZodType<RunOutput> | Record<string, any> =
      outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;

    let llm: Runnable<BaseLanguageModelInput>;
    let outputParser: BaseLLMOutputParser<RunOutput>;

    if (method === "jsonMode") {
      let outputSchema: JsonSchema7Type | undefined;
      if (isInteropZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
        outputSchema = toJsonSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
      llm = this.withConfig({
        response_format: { type: "json_object" },
        ls_structured_output_format: {
          kwargs: { method: "jsonMode" },
          schema: outputSchema,
        },
      } as Partial<CallOptions>);
    } else {
      let functionName = name ?? "extract";
      // Is function calling
      if (isInteropZodSchema(schema)) {
        const asJsonSchema = toJsonSchema(schema);
        llm = this.bindTools([
          {
            type: "function" as const,
            function: {
              name: functionName,
              description: asJsonSchema.description,
              parameters: asJsonSchema,
            },
          },
        ]).withConfig({
          tool_choice: "any",
          ls_structured_output_format: {
            kwargs: { method: "functionCalling" },
            schema: asJsonSchema,
          },
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
          openAIFunctionDefinition = {
            name: functionName,
            description: schema.description ?? "",
            parameters: schema,
          };
        }
        llm = this.bindTools([
          {
            type: "function" as const,
            function: openAIFunctionDefinition,
          },
        ]).withConfig({
          tool_choice: "any",
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
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]);
  }
}
