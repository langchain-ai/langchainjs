import Cerebras from "@cerebras/cerebras_cloud_sdk";

import {
  AIMessage,
  AIMessageChunk,
  UsageMetadata,
  type BaseMessage,
} from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  type BaseChatModelParams,
  BindToolsInput,
  LangSmithParams,
  ToolChoice,
} from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { concat } from "@langchain/core/utils/stream";
import {
  getSchemaDescription,
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

import {
  convertToCerebrasMessageParams,
  formatToCerebrasToolChoice,
} from "./utils.js";

/**
 * Input to chat model class.
 */
export interface ChatCerebrasInput extends BaseChatModelParams {
  model: string;
  apiKey?: string;
  streaming?: boolean;
  maxTokens?: number;
  maxCompletionTokens?: number;
  temperature?: number;
  topP?: number;
  seed?: number;
  timeout?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetch?: (...args: any) => any;
}

export interface ChatCerebrasCallOptions
  extends BaseChatModelCallOptions,
    Pick<Cerebras.RequestOptions, "httpAgent" | "headers"> {
  tools?: BindToolsInput[];
  tool_choice?: ToolChoice;
  user?: string;
  response_format?: Cerebras.ChatCompletionCreateParams["response_format"];
}

/**
 * Cerebras chat model integration.
 *
 * Setup:
 * Install `@langchain/cerebras` and set an environment variable named `CEREBRAS_API_KEY`.
 *
 * ```bash
 * npm install @langchain/cerebras
 * export CEREBRAS_API_KEY="your-api-key"
 * ```
 *
 * ## [Constructor args](https://api.js.langchain.com/classes/langchain_cerebras.ChatCerebras.html#constructor)
 *
 * ## [Runtime args](https://api.js.langchain.com/interfaces/langchain_cerebras.ChatCerebrasCallOptions.html)
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
 * import { ChatCerebras } from '@langchain/cerebras';
 *
 * const llm = new ChatCerebras({
 *   model: "llama-3.3-70b",
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
 *   "id": "run-9281952d-d4c5-424c-9c18-c6ad62dd6684",
 *   "content": "J'adore la programmation.",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "id": "chatcmpl-bb411272-aac5-44a5-b793-ae70bd94fd3d",
 *     "created": 1735784442,
 *     "model": "llama-3.3-70b",
 *     "system_fingerprint": "fp_2e2a2a083c",
 *     "object": "chat.completion",
 *     "time_info": {
 *       "queue_time": 0.000096069,
 *       "prompt_time": 0.002166527,
 *       "completion_time": 0.012331633,
 *       "total_time": 0.01629185676574707,
 *       "created": 1735784442
 *     }
 *   },
 *   "tool_calls": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 55,
 *     "output_tokens": 9,
 *     "total_tokens": 64
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
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": "",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {}
 * }
 * AIMessageChunk {
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": "J",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {}
 * }
 * AIMessageChunk {
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": "'",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {}
 * }
 * AIMessageChunk {
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": "ad",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {}
 * }
 * AIMessageChunk {
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": "ore",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {}
 * }
 * AIMessageChunk {
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": " la",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk"
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {}
 * }
 * ...
 * AIMessageChunk {
 *   "id": "run-1756a5b2-2ce0-47a9-81e0-2195bf893bd4",
 *   "content": "",
 *   "additional_kwargs": {},
 *   "response_metadata": {
 *     "finish_reason": "stop",
 *     "id": "chatcmpl-15c80082-4475-423c-b140-7b0a556311ca",
 *     "system_fingerprint": "fp_2e2a2a083c",
 *     "model": "llama-3.3-70b",
 *     "created": 1735785346,
 *     "object": "chat.completion.chunk",
 *     "time_info": {
 *       "queue_time": 0.000100589,
 *       "prompt_time": 0.002167348,
 *       "completion_time": 0.012320277,
 *       "total_time": 0.0169985294342041,
 *       "created": 1735785346
 *     }
 *   },
 *   "tool_calls": [],
 *   "tool_call_chunks": [],
 *   "invalid_tool_calls": [],
 *   "usage_metadata": {
 *     "input_tokens": 55,
 *     "output_tokens": 9,
 *     "total_tokens": 64
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
 *   "content": "J'adore la programmation.",
 *   "additional_kwargs": {},
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
 * const llmForToolCalling = new ChatCerebras({
 *   model: "llama-3.3-70b",
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
export class ChatCerebras
  extends BaseChatModel<ChatCerebrasCallOptions>
  implements ChatCerebrasInput
{
  static lc_name() {
    return "ChatCerebras";
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "CEREBRAS_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "CEREBRAS_API_KEY",
    };
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "cerebras",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.max_completion_tokens ?? undefined,
      ls_stop: options.stop,
    };
  }

  client: Cerebras;

  model: string;

  maxCompletionTokens?: number;

  temperature?: number;

  topP?: number;

  seed?: number;

  streaming?: boolean;

  constructor(fields: ChatCerebrasInput) {
    super(fields ?? {});
    this.model = fields.model;
    this.maxCompletionTokens = fields.maxCompletionTokens;
    this.temperature = fields.temperature;
    this.topP = fields.topP;
    this.seed = fields.seed;
    this.streaming = fields.streaming;
    this.client = new Cerebras({
      apiKey: fields.apiKey ?? getEnvironmentVariable("CEREBRAS_API_KEY"),
      timeout: fields.timeout,
      // Rely on built-in async caller
      maxRetries: 0,
      fetch: fields.fetch,
    });
  }

  // Replace
  _llmType() {
    return "cerebras";
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this["ParsedCallOptions"]>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, ChatCerebrasCallOptions> {
    return this.withConfig({
      tools: tools.map((tool) => convertToOpenAITool(tool)),
      ...kwargs,
    });
  }

  /**
   * A method that returns the parameters for an Ollama API call. It
   * includes model and options parameters.
   * @param options Optional parsed call options.
   * @returns An object containing the parameters for an Ollama API call.
   */
  override invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<Cerebras.ChatCompletionCreateParams, "stream" | "messages"> {
    return {
      model: this.model,
      max_completion_tokens: this.maxCompletionTokens,
      temperature: this.temperature,
      top_p: this.topP,
      seed: this.seed,
      stop: options?.stop,
      response_format: options?.response_format,
      user: options?.user,
      tools: options?.tools?.length
        ? options.tools.map(
            (tool) =>
              convertToOpenAITool(
                tool
              ) as Cerebras.ChatCompletionCreateParams.Tool
          )
        : undefined,
      tool_choice: formatToCerebrasToolChoice(options?.tool_choice),
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    // Handle streaming
    if (this.streaming) {
      let finalChunk: AIMessageChunk | undefined;
      for await (const chunk of this._streamResponseChunks(
        messages,
        options,
        runManager
      )) {
        if (!finalChunk) {
          finalChunk = chunk.message;
        } else {
          finalChunk = concat(finalChunk, chunk.message);
        }
      }

      // Convert from AIMessageChunk to AIMessage since `generate` expects AIMessage.
      const nonChunkMessage = new AIMessage({
        id: finalChunk?.id,
        content: finalChunk?.content ?? "",
        tool_calls: finalChunk?.tool_calls,
        response_metadata: finalChunk?.response_metadata,
        usage_metadata: finalChunk?.usage_metadata,
      });
      return {
        generations: [
          {
            text:
              typeof nonChunkMessage.content === "string"
                ? nonChunkMessage.content
                : "",
            message: nonChunkMessage,
          },
        ],
      };
    }

    const res = await this.caller.call(async () => {
      const res = await this.client.chat.completions.create(
        {
          ...this.invocationParams(options),
          messages: convertToCerebrasMessageParams(messages),
          stream: false,
        },
        {
          headers: options.headers,
          httpAgent: options.httpAgent,
        }
      );
      return res;
    });

    const { choices, usage, ...rest } = res;
    // TODO: Remove casts when underlying types are fixed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const choice = (choices as any)[0];
    const content = choice?.message?.content ?? "";
    const usageMetadata: UsageMetadata = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_tokens: (usage as any)?.prompt_tokens,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output_tokens: (usage as any)?.completion_tokens,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      total_tokens: (usage as any)?.total_tokens,
    };

    return {
      generations: [
        {
          text: content,
          message: new AIMessage({
            content,
            tool_calls: choice?.message?.tool_calls?.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (toolCall: any) => ({
                id: toolCall.id,
                name: toolCall.function?.name,
                args: JSON.parse(toolCall.function?.arguments),
                index: toolCall.index,
                type: "tool_call",
              })
            ),
            usage_metadata: usageMetadata,
            response_metadata: rest,
          }),
        },
      ],
    };
  }

  /**
   * Implement to support streaming.
   * Should yield chunks iteratively.
   */
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = await this.caller.call(async () => {
      const res = await this.client.chat.completions.create(
        {
          ...this.invocationParams(options),
          messages: convertToCerebrasMessageParams(messages),
          stream: true,
        },
        {
          headers: options.headers,
          httpAgent: options.httpAgent,
        }
      );
      return res;
    });
    for await (const chunk of stream) {
      const { choices, system_fingerprint, model, id, object, usage, ...rest } =
        chunk;
      // TODO: Remove casts when underlying types are fixed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const choice = (choices as any)[0];
      const content = choice?.delta?.content ?? "";
      let usageMetadata: UsageMetadata | undefined;
      if (usage !== undefined) {
        usageMetadata = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_tokens: (usage as any).prompt_tokens,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          output_tokens: (usage as any).completion_tokens,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          total_tokens: (usage as any).total_tokens,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generationInfo: Record<string, any> = {};
      if (choice.finish_reason != null) {
        generationInfo.finish_reason = choice.finish_reason;
        // Only include system fingerprint and related in the last chunk for now
        // to avoid concatenation issues
        generationInfo.id = id;
        generationInfo.system_fingerprint = system_fingerprint;
        generationInfo.model = model;
        generationInfo.object = object;
      }
      const generationChunk = new ChatGenerationChunk({
        text: content,
        message: new AIMessageChunk({
          content,
          tool_call_chunks: choice?.delta.tool_calls?.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (toolCallChunk: any) => ({
              id: toolCallChunk.id,
              name: toolCallChunk.function?.name,
              args: toolCallChunk.function?.arguments,
              index: toolCallChunk.index,
              type: "tool_call_chunk",
            })
          ),
          usage_metadata: usageMetadata,
          response_metadata: rest,
        }),
        generationInfo,
      });
      yield generationChunk;
      await runManager?.handleLLMNewToken(
        content,
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }
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
        {
          raw: BaseMessage;
          parsed: RunOutput;
        }
      > {
    if (config?.strict) {
      throw new Error(
        `"strict" mode is not supported for this model by default.`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: InteropZodType<RunOutput> | Record<string, any> =
      outputSchema;
    const name = config?.name;
    const description =
      getSchemaDescription(schema) ?? "A function available to call.";
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    if (method === "jsonMode") {
      throw new Error(
        `Cerebras withStructuredOutput implementation only supports "functionCalling" as a method.`
      );
    }
    let functionName = name ?? "extract";
    let tools: ToolDefinition[];
    if (isInteropZodSchema(schema)) {
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: toJsonSchema(schema),
          },
        },
      ];
    } else {
      if ("name" in schema) {
        functionName = schema.name;
      }
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: schema,
          },
        },
      ];
    }

    const llm = this.bindTools(tools, {
      tool_choice: tools[0].function.name,
    });
    const outputParser = RunnableLambda.from<AIMessageChunk, RunOutput>(
      (input: AIMessageChunk): RunOutput => {
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error("No tool calls found in the response.");
        }
        const toolCall = input.tool_calls.find(
          (tc) => tc.name === functionName
        );
        if (!toolCall) {
          throw new Error(`No tool call found with name ${functionName}.`);
        }
        return toolCall.args as RunOutput;
      }
    );

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatCerebrasStructuredOutput",
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
      runName: "ChatCerebrasStructuredOutput",
    });
  }
}
