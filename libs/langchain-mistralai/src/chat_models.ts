import { v4 as uuidv4 } from "uuid";
import {
  ChatCompletionResponse,
  Function as MistralAIFunction,
  ToolCalls as MistralAIToolCalls,
  ResponseFormat,
  ChatCompletionResponseChunk,
  ChatRequest,
  Tool as MistralAITool,
  Message as MistralAIMessage,
} from "@mistralai/mistralai";
import {
  MessageType,
  type BaseMessage,
  MessageContent,
  AIMessage,
  HumanMessage,
  HumanMessageChunk,
  AIMessageChunk,
  ToolMessageChunk,
  ChatMessageChunk,
  FunctionMessageChunk,
  OpenAIToolCall,
  isAIMessage,
} from "@langchain/core/messages";
import type {
  BaseLanguageModelInput,
  BaseLanguageModelCallOptions,
  StructuredOutputMethodParams,
  StructuredOutputMethodOptions,
  FunctionDefinition,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
  LangSmithParams,
} from "@langchain/core/language_models/chat_models";

import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { StructuredTool, StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
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
} from "@langchain/core/runnables";
import { zodToJsonSchema } from "zod-to-json-schema";

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

export type MistralAIToolChoice = "auto" | "any" | "none";

type MistralAIToolInput = { type: string; function: MistralAIFunction };
interface MistralAICallOptions
  extends Omit<BaseLanguageModelCallOptions, "stop"> {
  response_format?: {
    type: "text" | "json_object";
  };
  tools: StructuredToolInterface[] | MistralAIToolInput[] | MistralAITool[];
  tool_choice?: MistralAIToolChoice;
}

export interface ChatMistralAICallOptions extends MistralAICallOptions {}

/**
 * Input to chat model class.
 */
export interface ChatMistralAIInput extends BaseChatModelParams {
  /**
   * The API key to use.
   * @default {process.env.MISTRAL_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * Alias for `model`
   * @default {"mistral-small-latest"}
   */
  modelName?: string;
  /**
   * The name of the model to use.
   * @default {"mistral-small-latest"}
   */
  model?: string;
  /**
   * Override the default endpoint.
   */
  endpoint?: string;
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

  const getContent = (content: MessageContent): string => {
    if (typeof content === "string") {
      return content;
    }
    throw new Error(
      `ChatMistralAI does not support non text message content. Received: ${JSON.stringify(
        content,
        null,
        2
      )}`
    );
  };

  const getTools = (message: BaseMessage): MistralAIToolCalls[] | undefined => {
    if (isAIMessage(message) && !!message.tool_calls?.length) {
      return message.tool_calls
        .map((toolCall) => ({ ...toolCall, id: toolCall.id }))
        .map(convertLangChainToolCallToOpenAI) as MistralAIToolCalls[];
    }
    if (!message.additional_kwargs.tool_calls?.length) {
      return undefined;
    }
    const toolCalls: Omit<OpenAIToolCall, "index">[] =
      message.additional_kwargs.tool_calls;
    return toolCalls?.map((toolCall) => ({
      id: toolCall.id,
      type: "function",
      function: toolCall.function,
    }));
  };

  return messages.map((message) => {
    const toolCalls = getTools(message);
    const content = toolCalls === undefined ? getContent(message.content) : "";
    return {
      role: getRole(message._getType()),
      content,
      tool_calls: toolCalls,
    };
  }) as MistralAIMessage[];
}

function mistralAIResponseToChatMessage(
  choice: ChatCompletionResponse["choices"][0]
): BaseMessage {
  const { message } = choice;
  // MistralAI SDK does not include tool_calls in the non
  // streaming return type, so we need to extract it like this
  // to satisfy typescript.
  let rawToolCalls: MistralAIToolCalls[] = [];
  if ("tool_calls" in message && Array.isArray(message.tool_calls)) {
    rawToolCalls = message.tool_calls as MistralAIToolCalls[];
  }
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
        content: message.content ?? "",
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
        additional_kwargs: {
          tool_calls: rawToolCalls.length
            ? rawToolCalls.map((toolCall) => ({
                ...toolCall,
                type: "function",
              }))
            : undefined,
        },
      });
    }
    default:
      return new HumanMessage(message.content ?? "");
  }
}

function _convertDeltaToMessageChunk(delta: {
  role?: string | undefined;
  content?: string | undefined;
  tool_calls?: MistralAIToolCalls[] | undefined;
}) {
  if (!delta.content && !delta.tool_calls) {
    return null;
  }
  // Our merge additional kwargs util function will throw unless there
  // is an index key in each tool object (as seen in OpenAI's) so we
  // need to insert it here.
  const rawToolCallChunksWithIndex = delta.tool_calls?.length
    ? delta.tool_calls?.map(
        (toolCall, index): OpenAIToolCall => ({
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
  const content = delta.content ?? "";
  let additional_kwargs;
  const toolCallChunks = [];
  if (rawToolCallChunksWithIndex !== undefined) {
    additional_kwargs = {
      tool_calls: rawToolCallChunksWithIndex,
    };
    for (const rawToolCallChunk of rawToolCallChunksWithIndex) {
      toolCallChunks.push({
        name: rawToolCallChunk.function?.name,
        args: rawToolCallChunk.function?.arguments,
        id: rawToolCallChunk.id,
        index: rawToolCallChunk.index,
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

function _convertStructuredToolToMistralTool(
  tools: StructuredToolInterface[]
): MistralAITool[] {
  return tools.map((tool) => {
    const description = tool.description ?? `Tool: ${tool.name}`;
    return {
      type: "function",
      function: {
        name: tool.name,
        description,
        parameters: zodToJsonSchema(tool.schema),
      },
    };
  });
}

/**
 * Integration with a chat model.
 */
export class ChatMistralAI<
    CallOptions extends MistralAICallOptions = MistralAICallOptions
  >
  extends BaseChatModel<CallOptions, AIMessageChunk>
  implements ChatMistralAIInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatMistralAI";
  }

  modelName = "mistral-small-latest";

  model = "mistral-small-latest";

  apiKey: string;

  endpoint?: string;

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

  lc_serializable = true;

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
    this.endpoint = fields?.endpoint;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.safeMode = fields?.safeMode ?? this.safeMode;
    this.safePrompt = fields?.safePrompt ?? this.safePrompt;
    this.randomSeed = fields?.seed ?? fields?.randomSeed ?? this.seed;
    this.seed = this.randomSeed;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
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
  ): Omit<ChatRequest, "messages"> {
    const { response_format, tools, tool_choice } = options ?? {};
    const mistralAITools: Array<MistralAITool> | undefined = tools
      ?.map((tool) => {
        if ("lc_namespace" in tool) {
          return _convertStructuredToolToMistralTool([tool]);
        }
        if (!tool.function.description) {
          return {
            type: "function",
            function: {
              name: tool.function.name,
              description: `Tool: ${tool.function.name}`,
              parameters: tool.function.parameters,
            },
          } as MistralAITool;
        }
        return tool as MistralAITool;
      })
      .flat();
    const params: Omit<ChatRequest, "messages"> = {
      model: this.model,
      tools: mistralAITools,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      topP: this.topP,
      randomSeed: this.seed,
      safeMode: this.safeMode,
      safePrompt: this.safePrompt,
      toolChoice: tool_choice,
      responseFormat: response_format as ResponseFormat,
    };
    return params;
  }

  override bindTools(
    tools: (Record<string, unknown> | StructuredToolInterface)[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    const mistralAITools = tools
      ?.map((tool) => {
        if ("lc_namespace" in tool) {
          return _convertStructuredToolToMistralTool([tool as StructuredTool]);
        }
        return tool;
      })
      .flat();
    return this.bind({
      tools: mistralAITools,
      ...kwargs,
    } as CallOptions);
  }

  /**
   * Calls the MistralAI API with retry logic in case of failures.
   * @param {ChatRequest} input The input to send to the MistralAI API.
   * @returns {Promise<MistralAIChatCompletionResult | AsyncGenerator<MistralAIChatCompletionResult>>} The response from the MistralAI API.
   */
  async completionWithRetry(
    input: ChatRequest,
    streaming: true
  ): Promise<AsyncGenerator<ChatCompletionResponseChunk>>;

  async completionWithRetry(
    input: ChatRequest,
    streaming: false
  ): Promise<ChatCompletionResponse>;

  async completionWithRetry(
    input: ChatRequest,
    streaming: boolean
  ): Promise<
    ChatCompletionResponse | AsyncGenerator<ChatCompletionResponseChunk>
  > {
    const { MistralClient } = await this.imports();
    const client = new MistralClient(this.apiKey, this.endpoint);

    return this.caller.call(async () => {
      try {
        let res:
          | ChatCompletionResponse
          | AsyncGenerator<ChatCompletionResponseChunk>;
        if (streaming) {
          res = client.chatStream(input);
        } else {
          res = await client.chat(input);
        }
        return res;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (e.message?.includes("status: 400")) {
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
    const shouldStream = !!options.signal ?? !!options.timeout;

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

    const {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: totalTokens,
    } = response?.usage ?? {};

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
      const text = part.message?.content ?? "";
      const generation: ChatGeneration = {
        text,
        message: mistralAIResponseToChatMessage(part),
      };
      if (part.finish_reason) {
        generation.generationInfo = { finish_reason: part.finish_reason };
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
    for await (const data of streamIterable) {
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
      const message = _convertDeltaToMessageChunk(delta);
      if (message === null) {
        // Do not yield a chunk if the message is empty
        continue;
      }
      const generationChunk = new ChatGenerationChunk({
        message,
        text: delta.content ?? "",
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

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | StructuredOutputMethodParams<RunOutput, false>
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
      | StructuredOutputMethodParams<RunOutput, true>
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
      | StructuredOutputMethodParams<RunOutput, boolean>
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
    let schema: z.ZodType<RunOutput> | Record<string, any>;
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
    let outputParser: BaseLLMOutputParser<RunOutput>;

    if (method === "jsonMode") {
      llm = this.bind({
        response_format: { type: "json_object" },
      } as Partial<CallOptions>);
      if (isZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      let functionName = name ?? "extract";
      // Is function calling
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
          tool_choice: "auto",
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
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: openAIFunctionDefinition,
            },
          ],
          tool_choice: "auto",
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

  /** @ignore */
  private async imports() {
    const { default: MistralClient } = await import("@mistralai/mistralai");
    return { MistralClient };
  }
}

function isZodSchema<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends Record<string, any> = Record<string, any>
>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: z.ZodType<RunOutput> | Record<string, any>
): input is z.ZodType<RunOutput> {
  // Check for a characteristic method of Zod schemas
  return typeof (input as z.ZodType<RunOutput>)?.parse === "function";
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
