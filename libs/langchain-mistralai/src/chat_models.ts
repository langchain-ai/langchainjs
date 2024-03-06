import {
  ChatCompletionResponse,
  Function as MistralAIFunction,
  ToolCalls as MistralAIToolCalls,
  ToolChoice as MistralAIToolChoice,
  ResponseFormat,
  ChatCompletionResponseChunk,
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
} from "@langchain/core/messages";
import {
  BaseLanguageModelInput,
  type BaseLanguageModelCallOptions,
  StructuredOutputMethodParams,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  BaseChatModel,
} from "@langchain/core/language_models/chat_models";

import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import { StructuredToolInterface } from "@langchain/core/tools";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import { z } from "zod";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";
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

type MistralAIInputMessage = {
  role: string;
  name?: string;
  content: string | string[];
  tool_calls?: MistralAIToolCalls[];
};

type MistralAIToolInput = { type: string; function: MistralAIFunction };

type MistralAIChatCompletionOptions = {
  model: string;
  messages: Array<{
    role: string;
    name?: string;
    content: string | string[];
    tool_calls?: MistralAIToolCalls[];
  }>;
  tools?: Array<MistralAIToolInput>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  randomSeed?: number;
  safeMode?: boolean;
  safePrompt?: boolean;
  toolChoice?: MistralAIToolChoice;
  responseFormat?: ResponseFormat;
};

interface MistralAICallOptions extends BaseLanguageModelCallOptions {
  response_format?: {
    type: "text" | "json_object";
  };
  tools: StructuredToolInterface[] | MistralAIToolInput[];
  tool_choice?: MistralAIToolChoice;
}

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
   * @default {"mistral-small-latest"}
   */
  modelName?: string;
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
   */
  randomSeed?: number;
}

function convertMessagesToMistralMessages(
  messages: Array<BaseMessage>
): Array<MistralAIInputMessage> {
  const getRole = (role: MessageType) => {
    switch (role) {
      case "human":
        return "user";
      case "ai":
        return "assistant";
      case "system":
        return "system";
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

  return messages.map((message) => ({
    role: getRole(message._getType()),
    content: getContent(message.content),
  }));
}

function mistralAIResponseToChatMessage(
  choice: ChatCompletionResponse["choices"][0]
): BaseMessage {
  const { message } = choice;
  // MistralAI SDK does not include tool_calls in the non
  // streaming return type, so we need to extract it like this
  // to satisfy typescript.
  let toolCalls: MistralAIToolCalls[] = [];
  if ("tool_calls" in message) {
    toolCalls = message.tool_calls as MistralAIToolCalls[];
  }
  switch (message.role) {
    case "assistant":
      return new AIMessage({
        content: message.content ?? "",
        additional_kwargs: {
          tool_calls: toolCalls,
        },
      });
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
  const toolCallsWithIndex = delta.tool_calls?.length
    ? delta.tool_calls?.map((toolCall, index) => ({
        ...toolCall,
        index,
      }))
    : undefined;

  let role = "assistant";
  if (delta.role) {
    role = delta.role;
  } else if (toolCallsWithIndex) {
    role = "tool";
  }
  const content = delta.content ?? "";
  let additional_kwargs;
  if (toolCallsWithIndex) {
    additional_kwargs = {
      tool_calls: toolCallsWithIndex,
    };
  } else {
    additional_kwargs = {};
  }

  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else if (role === "tool") {
    return new ToolMessageChunk({
      content,
      additional_kwargs,
      tool_call_id: toolCallsWithIndex?.[0].id ?? "",
    });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

function _convertStructuredToolToMistralTool(
  tools: StructuredToolInterface[]
): MistralAIToolInput[] {
  return tools.map((tool) => convertToOpenAITool(tool) as MistralAIToolInput);
}

/**
 * Integration with a chat model.
 */
export class ChatMistralAI<
    CallOptions extends MistralAICallOptions = MistralAICallOptions
  >
  extends BaseChatModel<CallOptions>
  implements ChatMistralAIInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatMistralAI";
  }

  modelName = "mistral-small-latest";

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
    this.randomSeed = fields?.randomSeed ?? this.randomSeed;
    this.modelName = fields?.modelName ?? this.modelName;
  }

  _llmType() {
    return "mistral_ai";
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<MistralAIChatCompletionOptions, "messages"> {
    const { response_format, tools, tool_choice } = options ?? {};
    const mistralAITools: MistralAIToolInput[] =
      tools
        ?.map((tool) => {
          if ("lc_namespace" in tool) {
            return _convertStructuredToolToMistralTool([tool]);
          }
          return tool;
        })
        .flat() ?? [];
    const params: Omit<MistralAIChatCompletionOptions, "messages"> = {
      model: this.modelName,
      tools: mistralAITools,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      topP: this.topP,
      randomSeed: this.randomSeed,
      safeMode: this.safeMode,
      safePrompt: this.safePrompt,
      toolChoice: tool_choice,
      responseFormat: response_format as ResponseFormat,
    };
    return params;
  }

  /**
   * Calls the MistralAI API with retry logic in case of failures.
   * @param {MistralAIChatCompletionOptions} input The input to send to the MistralAI API.
   * @returns {Promise<MistralAIChatCompletionResult | AsyncGenerator<MistralAIChatCompletionResult>>} The response from the MistralAI API.
   */
  async completionWithRetry(
    input: MistralAIChatCompletionOptions,
    streaming: true
  ): Promise<AsyncGenerator<ChatCompletionResponseChunk>>;

  async completionWithRetry(
    input: MistralAIChatCompletionOptions,
    streaming: false
  ): Promise<ChatCompletionResponse>;

  async completionWithRetry(
    input: MistralAIChatCompletionOptions,
    streaming: boolean
  ): Promise<
    ChatCompletionResponse | AsyncGenerator<ChatCompletionResponseChunk>
  > {
    const { MistralClient } = await this.imports();
    const client = new MistralClient(this.apiKey, this.endpoint);

    return this.caller.call(async () => {
      let res:
        | ChatCompletionResponse
        | AsyncGenerator<ChatCompletionResponseChunk>;
      if (streaming) {
        res = client.chatStream(input);
      } else {
        res = await client.chat(input);
      }
      return res;
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
    if (options.signal?.aborted) {
      throw new Error("AbortError");
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
    let outputParser: JsonOutputKeyToolsParser | JsonOutputParser<RunOutput>;

    if (method === "jsonMode") {
      llm = this.bind({
        response_format: { type: "json_object" },
      } as Partial<CallOptions>);
      outputParser = new JsonOutputParser<RunOutput>();
    } else {
      const functionName = name ?? "extract";
      // Is function calling
      if (isZodSchema(schema)) {
        const asZodSchema = zodToJsonSchema(schema);
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description: asZodSchema.description,
                parameters: asZodSchema,
              },
            },
          ],
          tool_choice: "auto",
        } as Partial<CallOptions>);
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      } else {
        llm = this.bind({
          tools: [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description: schema.description,
                parameters: schema,
              },
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
  // prettier-ignore
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunOutput extends z.ZodObject<any, any, any, any> = z.ZodObject<any, any, any, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
>(input: any): input is z.ZodEffects<RunOutput> {
  // Check for a characteristic method of Zod schemas
  return typeof input?.parse === "function";
}

function isStructuredOutputMethodParams(
  x: unknown
): x is StructuredOutputMethodParams<Record<string, any>> {
  return (
    x !== undefined &&
    typeof (x as StructuredOutputMethodParams<Record<string, any>>).schema ===
      "object"
  );
}
