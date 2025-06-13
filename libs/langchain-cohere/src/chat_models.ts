/* eslint-disable @typescript-eslint/no-explicit-any */
import { Cohere, CohereClient } from "cohere-ai";
import { ToolResult } from "cohere-ai/api/index.js";
import {
  AIMessage,
  type BaseMessage,
  isAIMessage,
  MessageContent,
  MessageType,
} from "@langchain/core/messages";
import {
  BaseLanguageModelInput,
  isOpenAITool,
} from "@langchain/core/language_models/base";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  type BaseChatModelParams,
  BindToolsInput,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  ToolCall,
  ToolCallChunk,
  ToolMessage,
} from "@langchain/core/messages/tool";
import * as uuid from "uuid";
import { Runnable } from "@langchain/core/runnables";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import { CohereClientOptions, getCohereClient } from "./client.js";

type ChatCohereToolType = BindToolsInput | Cohere.Tool;

/**
 * Input interface for ChatCohere
 */
export interface BaseChatCohereInput extends BaseChatModelParams {
  /**
   * The API key to use.
   * @default {process.env.COHERE_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default {"command"}
   */
  model?: string;
  /**
   * What sampling temperature to use, between 0.0 and 2.0.
   * Higher values like 0.8 will make the output more random,
   * while lower values like 0.2 will make it more focused
   * and deterministic.
   * @default {0.3}
   */
  temperature?: number;
  /**
   * Whether or not to stream the response.
   * @default {false}
   */
  streaming?: boolean;
  /**
   * Whether or not to include token usage when streaming.
   * This will include an extra chunk at the end of the stream
   * with `eventType: "stream-end"` and the token usage in
   * `usage_metadata`.
   * @default {true}
   */
  streamUsage?: boolean;
}

export type ChatCohereInput = BaseChatCohereInput & CohereClientOptions;

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export interface ChatCohereCallOptions
  extends BaseChatModelCallOptions,
    Partial<Omit<Cohere.ChatRequest, "message" | "tools">>,
    Partial<Omit<Cohere.ChatStreamRequest, "message" | "tools">>,
    Pick<ChatCohereInput, "streamUsage"> {
  tools?: ChatCohereToolType[];
}

/** @deprecated Import as ChatCohereCallOptions instead. */
export interface CohereChatCallOptions extends ChatCohereCallOptions {}

function convertToDocuments(
  observations: MessageContent
): Array<Record<string, any>> {
  /** Converts observations into a 'document' dict */
  const documents: Array<Record<string, any>> = [];
  let observationsList: Array<Record<string, any>> = [];

  if (typeof observations === "string") {
    // strings are turned into a key/value pair and a key of 'output' is added.
    observationsList = [{ output: observations }];
  } else if (
    // eslint-disable-next-line no-instanceof/no-instanceof
    observations instanceof Map ||
    (typeof observations === "object" &&
      observations !== null &&
      !Array.isArray(observations))
  ) {
    // single mappings are transformed into a list to simplify the rest of the code.
    observationsList = [observations];
  } else if (!Array.isArray(observations)) {
    // all other types are turned into a key/value pair within a list
    observationsList = [{ output: observations }];
  }

  for (let doc of observationsList) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (!(doc instanceof Map) && (typeof doc !== "object" || doc === null)) {
      // types that aren't Mapping are turned into a key/value pair.
      doc = { output: doc };
    }
    documents.push(doc);
  }

  return documents;
}

function convertMessageToCohereMessage(
  message: BaseMessage,
  toolResults: ToolResult[]
): Cohere.Message {
  const getRole = (role: MessageType) => {
    switch (role) {
      case "system":
        return "SYSTEM";
      case "human":
        return "USER";
      case "ai":
        return "CHATBOT";
      case "tool":
        return "TOOL";
      default:
        throw new Error(
          `Unknown message type: '${role}'. Accepted types: 'human', 'ai', 'system', 'tool'`
        );
    }
  };

  const getContent = (content: MessageContent): string => {
    if (typeof content === "string") {
      return content;
    }
    throw new Error(
      `ChatCohere does not support non text message content. Received: ${JSON.stringify(
        content,
        null,
        2
      )}`
    );
  };

  const getToolCall = (message: BaseMessage): Cohere.ToolCall[] => {
    if (isAIMessage(message) && message.tool_calls) {
      return message.tool_calls.map((toolCall) => ({
        name: toolCall.name,
        parameters: toolCall.args,
      }));
    }
    return [];
  };
  if (message._getType().toLowerCase() === "ai") {
    return {
      role: getRole(message._getType()),
      message: getContent(message.content),
      toolCalls: getToolCall(message),
    };
  } else if (message._getType().toLowerCase() === "tool") {
    return {
      role: getRole(message._getType()),
      message: getContent(message.content),
      toolResults,
    };
  } else if (
    message._getType().toLowerCase() === "human" ||
    message._getType().toLowerCase() === "system"
  ) {
    return {
      role: getRole(message._getType()),
      message: getContent(message.content),
    };
  } else {
    throw new Error(
      "Got unknown message type. Supported types are AIMessage, ToolMessage, HumanMessage, and SystemMessage"
    );
  }
}

function isCohereTool(tool: any): tool is Cohere.Tool {
  return (
    "name" in tool && "description" in tool && "parameterDefinitions" in tool
  );
}

function isToolMessage(message: BaseMessage): message is ToolMessage {
  return message._getType() === "tool";
}

function _convertJsonSchemaToCohereTool(jsonSchema: Record<string, any>) {
  const parameterDefinitionsProperties =
    "properties" in jsonSchema ? jsonSchema.properties : {};
  let parameterDefinitionsRequired =
    "required" in jsonSchema ? jsonSchema.required : [];

  const parameterDefinitionsFinal: Record<string, any> = {};

  // Iterate through all properties
  Object.keys(parameterDefinitionsProperties).forEach((propertyName) => {
    // Create the property in the new object
    parameterDefinitionsFinal[propertyName] =
      parameterDefinitionsProperties[propertyName];
    // Set the required property based on the 'required' array
    if (parameterDefinitionsRequired === undefined) {
      parameterDefinitionsRequired = [];
    }
    parameterDefinitionsFinal[propertyName].required =
      parameterDefinitionsRequired.includes(propertyName);
  });
  return parameterDefinitionsFinal;
}

function _formatToolsToCohere(
  tools: ChatCohereCallOptions["tools"]
): Cohere.Tool[] | undefined {
  if (!tools) {
    return undefined;
  } else if (tools.every(isCohereTool)) {
    return tools;
  } else if (tools.every(isOpenAITool)) {
    return tools.map((tool) => {
      return {
        name: tool.function.name,
        description: tool.function.description ?? "",
        parameterDefinitions: _convertJsonSchemaToCohereTool(
          tool.function.parameters
        ),
      };
    });
  } else if (tools.every(isLangChainTool)) {
    return tools.map((tool) => {
      const parameterDefinitionsFromZod = isInteropZodSchema(tool.schema)
        ? toJsonSchema(tool.schema)
        : tool.schema;
      return {
        name: tool.name,
        description: tool.description ?? "",
        parameterDefinitions: _convertJsonSchemaToCohereTool(
          parameterDefinitionsFromZod
        ),
      };
    });
  } else {
    throw new Error(
      `Can not pass in a mix of tool schema types to ChatCohere.`
    );
  }
}

/**
 * Integration for Cohere chat models.
 *
 * Setup:
 * Install `@langchain/cohere` and set a environment variable called `COHERE_API_KEY`.
 *
 * ```bash
 * npm install @langchain/cohere
 * export COHERE_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_cohere.ChatCohere.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_cohere.ChatCohereCallOptions.html)
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
 *     stop: ["\n"],
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
 * import { ChatCohere } from '@langchain/cohere';
 *
 * const llm = new ChatCohere({
 *   model: "command-r-plus",
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
 *   "content": "\"J'adore programmer.\"",
 *   "additional_kwargs": {
 *     ...
 *   },
 *   "response_metadata": {
 *     "estimatedTokenUsage": {
 *       "completionTokens": 6,
 *       "promptTokens": 75,
 *       "totalTokens": 81
 *     },
 *     "response_id": "54cebd43-737f-458b-bff4-01b220eaf373",
 *     "generationId": "48a567da-0f88-4606-bba6-becbeee464bd",
 *     "chatHistory": [
 *       {
 *         "role": "USER",
 *         "message": "Translate \"I love programming\" into French."
 *       },
 *       {
 *         "role": "CHATBOT",
 *         "message": "\"J'adore programmer.\""
 *       }
 *     ],
 *     "finishReason": "COMPLETE",
 *     "meta": {
 *       "apiVersion": {
 *         "version": "1"
 *       },
 *       "billedUnits": {
 *         "inputTokens": 9,
 *         "outputTokens": 6
 *       },
 *       "tokens": {
 *         "inputTokens": 75,
 *         "outputTokens": 6
 *       }
 *     }
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 75,
 *     "output_tokens": 6,
 *     "total_tokens": 81
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
 *   "content": "",
 *   "additional_kwargs": {
 *     "eventType": "stream-start",
 *     "is_finished": false,
 *     "generationId": "d62c8989-8af5-4357-af79-4ea8e6eb2baa"
 *   },
 *   "response_metadata": {
 *     "eventType": "stream-start",
 *     "is_finished": false,
 *     "generationId": "d62c8989-8af5-4357-af79-4ea8e6eb2baa"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "\"",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "J",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "'",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "adore",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": " programmer",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": ".\"",
 *   "additional_kwargs": {},
 *   "response_metadata": {},
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": []
 * }
 * AIMessageChunk {
 *   "content": "",
 *   "additional_kwargs": {
 *     "eventType": "stream-end"
 *   },
 *   "response_metadata": {
 *     "eventType": "stream-end",
 *     "response_id": "687f94a6-13b7-4c2c-98be-9ca5573c722f",
 *     "text": "\"J'adore programmer.\"",
 *     "generationId": "d62c8989-8af5-4357-af79-4ea8e6eb2baa",
 *     "chatHistory": [
 *       {
 *         "role": "USER",
 *         "message": "Translate \"I love programming\" into French."
 *       },
 *       {
 *         "role": "CHATBOT",
 *         "message": "\"J'adore programmer.\""
 *       }
 *     ],
 *     "finishReason": "COMPLETE",
 *     "meta": {
 *       "apiVersion": {
 *         "version": "1"
 *       },
 *       "billedUnits": {
 *         "inputTokens": 9,
 *         "outputTokens": 6
 *       },
 *       "tokens": {
 *         "inputTokens": 75,
 *         "outputTokens": 6
 *       }
 *     }
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 75,
 *     "output_tokens": 6,
 *     "total_tokens": 81
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
 *   "content": "\"J'adore programmer.\"",
 *   "additional_kwargs": {
 *     ...
 *   },
 *   "response_metadata": {
 *     "is_finished": false,
 *     "generationId": "303e0215-96f4-4da5-8c2a-10da3840afce303e0215-96f4-4da5-8c2a-10da3840afce",
 *     "response_id": "6a8cb7ef-f1b9-44f6-a1df-67aa506d3f0f",
 *     "text": "\"J'adore programmer.\"",
 *     "chatHistory": [
 *       {
 *         "role": "USER",
 *         "message": "Translate \"I love programming\" into French."
 *       },
 *       {
 *         "role": "CHATBOT",
 *         "message": "\"J'adore programmer.\""
 *       }
 *     ],
 *     "finishReason": "COMPLETE",
 *     "meta": {
 *       "apiVersion": {
 *         "version": "1"
 *       },
 *       "billedUnits": {
 *         "inputTokens": 9,
 *         "outputTokens": 6
 *       },
 *       "tokens": {
 *         "inputTokens": 75,
 *         "outputTokens": 6
 *       }
 *     }
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 75,
 *     "output_tokens": 6,
 *     "total_tokens": 81
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
 *     args: { location: 'LA' },
 *     id: 'ce8076ee-2ed3-429d-938c-14f3218c',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetWeather',
 *     args: { location: 'NY' },
 *     id: '23d1a96e-3a2c-46f4-9d9e-cccd02c6',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'LA' },
 *     id: '2bf9d627-310f-46ff-93a9-86baeae9',
 *     type: 'tool_call'
 *   },
 *   {
 *     name: 'GetPopulation',
 *     args: { location: 'NY' },
 *     id: 'c95e6ac0-ee9b-48de-86b2-12548fd1',
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
 *   punchline: 'Because she wanted to be a first-aid kit.',
 *   rating: 5,
 *   setup: 'Why did the cat join the Red Cross?'
 * }
 * ```
 * </details>
 *
 * <br />
 *
 * <summary><strong>Usage Metadata</strong></summary>
 *
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(input);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 *
 * ```txt
 * { input_tokens: 75, output_tokens: 6, total_tokens: 81 }
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
 *   estimatedTokenUsage: { completionTokens: 6, promptTokens: 75, totalTokens: 81 },
 *   response_id: 'a688ad65-4db2-4a7a-b6aa-124aa2410319',
 *   generationId: 'ee259727-18c5-43f7-b9bd-a2a60c0c040b',
 *   chatHistory: [
 *     {
 *       role: 'USER',
 *       message: 'Translate "I love programming" into French.'
 *     },
 *     { role: 'CHATBOT', message: `"J'adore programmer."` }
 *   ],
 *   finishReason: 'COMPLETE',
 *   meta: {
 *     apiVersion: { version: '1' },
 *     billedUnits: { inputTokens: 9, outputTokens: 6 },
 *     tokens: { inputTokens: 75, outputTokens: 6 }
 *   }
 * }
 * ```
 * </details>
 *
 * <br />
 */
export class ChatCohere<
    CallOptions extends ChatCohereCallOptions = ChatCohereCallOptions
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements ChatCohereInput
{
  static lc_name() {
    return "ChatCohere";
  }

  lc_serializable = true;

  client: CohereClient;

  model = "command-r-plus";

  temperature = 0.3;

  streaming = false;

  streamUsage: boolean = true;

  constructor(fields?: ChatCohereInput) {
    super(fields ?? {});

    this.client = getCohereClient(fields);

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.streaming = fields?.streaming ?? this.streaming;
    this.streamUsage = fields?.streamUsage ?? this.streamUsage;
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "cohere",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: this.temperature ?? undefined,
      ls_max_tokens:
        typeof params.maxTokens === "number" ? params.maxTokens : undefined,
      ls_stop: Array.isArray(params.stopSequences)
        ? (params.stopSequences as unknown as string[])
        : undefined,
    };
  }

  _llmType() {
    return "cohere";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    if (options.tool_choice) {
      throw new Error(
        "'tool_choice' call option is not supported by ChatCohere."
      );
    }

    const params = {
      model: this.model,
      preamble: options.preamble,
      conversationId: options.conversationId,
      promptTruncation: options.promptTruncation,
      connectors: options.connectors,
      searchQueriesOnly: options.searchQueriesOnly,
      documents: options.documents,
      temperature: options.temperature ?? this.temperature,
      forceSingleStep: options.forceSingleStep,
      tools: options.tools,
    };
    // Filter undefined entries
    return Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );
  }

  override bindTools(
    tools: ChatCohereToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    return this.withConfig({
      tools: _formatToolsToCohere(tools),
      ...kwargs,
    } as Partial<CallOptions>);
  }

  /** @ignore */
  private _getChatRequest(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Cohere.ChatRequest {
    const params = this.invocationParams(options);

    const toolResults = this._messagesToCohereToolResultsCurrChatTurn(messages);
    const chatHistory = [];
    let messageStr: string = "";
    let tempToolResults: {
      call: Cohere.ToolCall;
      outputs: any;
    }[] = [];

    if (!params.forceSingleStep) {
      for (let i = 0; i < messages.length - 1; i += 1) {
        const message = messages[i];
        // If there are multiple tool messages, then we need to aggregate them into one single tool message to pass into chat history
        if (message._getType().toLowerCase() === "tool") {
          tempToolResults = tempToolResults.concat(
            this._messageToCohereToolResults(messages, i)
          );

          if (
            i === messages.length - 1 ||
            !(messages[i + 1]._getType().toLowerCase() === "tool")
          ) {
            const cohere_message = convertMessageToCohereMessage(
              message,
              tempToolResults
            );
            chatHistory.push(cohere_message);
            tempToolResults = [];
          }
        } else {
          chatHistory.push(convertMessageToCohereMessage(message, []));
        }
      }

      messageStr =
        toolResults.length > 0
          ? ""
          : messages[messages.length - 1].content.toString();
    } else {
      messageStr = "";

      // if force_single_step is set to True, then message is the last human message in the conversation
      for (let i = 0; i < messages.length - 1; i += 1) {
        const message = messages[i];
        if (isAIMessage(message) && message.tool_calls) {
          continue;
        }

        // If there are multiple tool messages, then we need to aggregate them into one single tool message to pass into chat history
        if (message._getType().toLowerCase() === "tool") {
          tempToolResults = tempToolResults.concat(
            this._messageToCohereToolResults(messages, i)
          );

          if (
            i === messages.length - 1 ||
            !(messages[i + 1]._getType().toLowerCase() === "tool")
          ) {
            const cohereMessage = convertMessageToCohereMessage(
              message,
              tempToolResults
            );
            chatHistory.push(cohereMessage);
            tempToolResults = [];
          }
        } else {
          chatHistory.push(convertMessageToCohereMessage(message, []));
        }
      }

      // Add the last human message in the conversation to the message string
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message._getType().toLowerCase() === "human" && message.content) {
          messageStr = message.content.toString();
          break;
        }
      }
    }
    const req: Cohere.ChatRequest = {
      message: messageStr,
      chatHistory,
      toolResults: toolResults.length > 0 ? toolResults : undefined,
      ...params,
    };

    return req;
  }

  private _getCurrChatTurnMessages(messages: BaseMessage[]): BaseMessage[] {
    // Get the messages for the current chat turn.
    const currentChatTurnMessages: BaseMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      currentChatTurnMessages.push(message);
      if (message._getType().toLowerCase() === "human") {
        break;
      }
    }
    return currentChatTurnMessages.reverse();
  }

  private _messagesToCohereToolResultsCurrChatTurn(
    messages: BaseMessage[]
  ): Array<{
    call: Cohere.ToolCall;
    outputs: ReturnType<typeof convertToDocuments>;
  }> {
    /** Get tool_results from messages. */
    const toolResults: Array<{
      call: Cohere.ToolCall;
      outputs: ReturnType<typeof convertToDocuments>;
    }> = [];
    const currChatTurnMessages = this._getCurrChatTurnMessages(messages);

    for (const message of currChatTurnMessages) {
      if (isToolMessage(message)) {
        const toolMessage = message;
        const previousAiMsgs = currChatTurnMessages.filter(
          (msg) => isAIMessage(msg) && msg.tool_calls !== undefined
        ) as AIMessage[];
        if (previousAiMsgs.length > 0) {
          const previousAiMsg = previousAiMsgs[previousAiMsgs.length - 1];
          if (previousAiMsg.tool_calls) {
            toolResults.push(
              ...previousAiMsg.tool_calls
                .filter(
                  (lcToolCall) => lcToolCall.id === toolMessage.tool_call_id
                )
                .map((lcToolCall) => ({
                  call: {
                    name: lcToolCall.name,
                    parameters: lcToolCall.args,
                  },
                  outputs: convertToDocuments(toolMessage.content),
                }))
            );
          }
        }
      }
    }
    return toolResults;
  }

  private _messageToCohereToolResults(
    messages: BaseMessage[],
    toolMessageIndex: number
  ): Array<{ call: Cohere.ToolCall; outputs: any }> {
    /** Get tool_results from messages. */
    const toolResults: Array<{ call: Cohere.ToolCall; outputs: any }> = [];
    const toolMessage = messages[toolMessageIndex];

    if (!isToolMessage(toolMessage)) {
      throw new Error(
        "The message index does not correspond to an instance of ToolMessage"
      );
    }

    const messagesUntilTool = messages.slice(0, toolMessageIndex);
    const previousAiMessage = messagesUntilTool
      .filter((message) => isAIMessage(message) && message.tool_calls)
      .slice(-1)[0] as AIMessage;

    if (previousAiMessage.tool_calls) {
      toolResults.push(
        ...previousAiMessage.tool_calls
          .filter((lcToolCall) => lcToolCall.id === toolMessage.tool_call_id)
          .map((lcToolCall) => ({
            call: {
              name: lcToolCall.name,
              parameters: lcToolCall.args,
            },
            outputs: convertToDocuments(toolMessage.content),
          }))
      );
    }

    return toolResults;
  }

  private _formatCohereToolCalls(toolCalls: Cohere.ToolCall[] | null = null): {
    id: string;
    function: {
      name: string;
      arguments: Record<string, any>;
    };
    type: string;
  }[] {
    if (!toolCalls) {
      return [];
    }

    const formattedToolCalls = [];
    for (const toolCall of toolCalls) {
      formattedToolCalls.push({
        id: uuid.v4().substring(0, 32),
        function: {
          name: toolCall.name,
          arguments: toolCall.parameters, // Convert arguments to string
        },
        type: "function",
      });
    }
    return formattedToolCalls;
  }

  private _convertCohereToolCallToLangchain(
    toolCalls: Record<string, any>[]
  ): ToolCall[] {
    return toolCalls.map((toolCall) => ({
      name: toolCall.function.name,
      args: toolCall.function.arguments,
      id: toolCall.id,
      type: "tool_call",
    }));
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    // The last message in the array is the most recent, all other messages
    // are apart of the chat history.
    const request = this._getChatRequest(messages, options);

    // Handle streaming
    if (this.streaming) {
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
    const response: Cohere.NonStreamedChatResponse =
      await this.caller.callWithOptions(
        { signal: options.signal },
        async () => {
          let response;
          try {
            response = await this.client.chat(request);
          } catch (e: any) {
            e.status = e.status ?? e.statusCode;
            throw e;
          }
          return response;
        }
      );

    if (response.meta?.tokens) {
      const { inputTokens, outputTokens } = response.meta.tokens;

      if (outputTokens) {
        tokenUsage.completionTokens =
          (tokenUsage.completionTokens ?? 0) + outputTokens;
      }

      if (inputTokens) {
        tokenUsage.promptTokens = (tokenUsage.promptTokens ?? 0) + inputTokens;
      }

      tokenUsage.totalTokens =
        (tokenUsage.totalTokens ?? 0) +
        (tokenUsage.promptTokens ?? 0) +
        (tokenUsage.completionTokens ?? 0);
    }

    const generationInfo: Record<string, unknown> = { ...response };
    delete generationInfo.text;
    if (response.toolCalls && response.toolCalls.length > 0) {
      // Only populate tool_calls when 1) present on the response and
      // 2) has one or more calls.
      generationInfo.toolCalls = this._formatCohereToolCalls(
        response.toolCalls
      );
    }
    let toolCalls: ToolCall[] = [];
    if ("toolCalls" in generationInfo) {
      toolCalls = this._convertCohereToolCallToLangchain(
        generationInfo.toolCalls as Record<string, any>[]
      );
    }

    const generations: ChatGeneration[] = [
      {
        text: response.text,
        message: new AIMessage({
          content: response.text,
          additional_kwargs: generationInfo,
          tool_calls: toolCalls,
          usage_metadata: {
            input_tokens: tokenUsage.promptTokens ?? 0,
            output_tokens: tokenUsage.completionTokens ?? 0,
            total_tokens: tokenUsage.totalTokens ?? 0,
          },
        }),
        generationInfo,
      },
    ];
    return {
      generations,
      llmOutput: { estimatedTokenUsage: tokenUsage },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const request = this._getChatRequest(messages, options);

    // All models have a built in `this.caller` property for retries
    const stream = await this.caller.call(async () => {
      let stream;
      try {
        stream = await this.client.chatStream(request);
      } catch (e: any) {
        e.status = e.status ?? e.statusCode;
        throw e;
      }
      return stream;
    });
    for await (const chunk of stream) {
      if (chunk.eventType === "text-generation") {
        yield new ChatGenerationChunk({
          text: chunk.text,
          message: new AIMessageChunk({
            content: chunk.text,
          }),
        });
        await runManager?.handleLLMNewToken(chunk.text);
      } else if (chunk.eventType !== "stream-end") {
        // Used for when the user uses their RAG/Search/other API
        // and the stream takes more actions then just text generation.
        yield new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: {
              ...chunk,
            },
          }),
          generationInfo: {
            ...chunk,
          },
        });
      } else if (
        chunk.eventType === "stream-end" &&
        (this.streamUsage || options.streamUsage)
      ) {
        // stream-end events contain the final token count
        const input_tokens = chunk.response.meta?.tokens?.inputTokens ?? 0;
        const output_tokens = chunk.response.meta?.tokens?.outputTokens ?? 0;
        const chunkGenerationInfo: Record<string, any> = {
          ...chunk.response,
        };

        if (chunk.response.toolCalls && chunk.response.toolCalls.length > 0) {
          // Only populate tool_calls when 1) present on the response and
          // 2) has one or more calls.
          chunkGenerationInfo.toolCalls = this._formatCohereToolCalls(
            chunk.response.toolCalls
          );
        }

        let toolCallChunks: ToolCallChunk[] = [];
        const toolCalls = chunkGenerationInfo.toolCalls ?? [];

        if (toolCalls.length > 0) {
          toolCallChunks = toolCalls.map((toolCall: any) => ({
            name: toolCall.function.name,
            args: toolCall.function.arguments,
            id: toolCall.id,
            index: toolCall.index,
            type: "tool_call_chunk",
          }));
        }

        yield new ChatGenerationChunk({
          text: "",
          message: new AIMessageChunk({
            content: "",
            additional_kwargs: {
              eventType: "stream-end",
            },
            tool_call_chunks: toolCallChunks,
            usage_metadata: {
              input_tokens,
              output_tokens,
              total_tokens: input_tokens + output_tokens,
            },
          }),
          generationInfo: {
            eventType: "stream-end",
            ...chunkGenerationInfo,
          },
        });
      }
    }
  }

  _combineLLMOutput(...llmOutputs: CohereLLMOutput[]): CohereLLMOutput {
    return llmOutputs.reduce<{
      [key in keyof CohereLLMOutput]: Required<CohereLLMOutput[key]>;
    }>(
      (acc, llmOutput) => {
        if (llmOutput && llmOutput.estimatedTokenUsage) {
          let completionTokens = acc.estimatedTokenUsage?.completionTokens ?? 0;
          let promptTokens = acc.estimatedTokenUsage?.promptTokens ?? 0;
          let totalTokens = acc.estimatedTokenUsage?.totalTokens ?? 0;

          completionTokens +=
            llmOutput.estimatedTokenUsage.completionTokens ?? 0;
          promptTokens += llmOutput.estimatedTokenUsage.promptTokens ?? 0;
          totalTokens += llmOutput.estimatedTokenUsage.totalTokens ?? 0;

          acc.estimatedTokenUsage = {
            completionTokens,
            promptTokens,
            totalTokens,
          };
        }
        return acc;
      },
      {
        estimatedTokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      }
    );
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "COHERE_API_KEY",
      api_key: "COHERE_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "cohere_api_key",
      api_key: "cohere_api_key",
    };
  }
}

interface CohereLLMOutput {
  estimatedTokenUsage?: TokenUsage;
}
