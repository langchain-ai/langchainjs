import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BindToolsInput,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  ChatMessage,
  AIMessageChunk,
  type OpenAIToolCall,
  type UsageMetadata,
  type ToolMessage,
} from "@langchain/core/messages";
import { type ChatResult } from "@langchain/core/outputs";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import {
  convertLangChainToolCallToOpenAI,
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  ToolDefinition,
} from "@langchain/core/language_models/base";
import { type ToolCallChunk } from "@langchain/core/messages/tool";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  getSchemaDescription,
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

/**
 * Type representing the role of a message in the Tongyi chat model.
 */
export type TongyiMessageRole = "system" | "assistant" | "user" | "tool";

/**
 * Interface representing a message in the Tongyi chat model.
 */
interface TongyiToolCall {
  id?: string;
  type?: string;
  index?: number;
  function?: {
    name?: string;
    arguments?: string | Record<string, unknown>;
  };
}

interface TongyiMessage {
  role: TongyiMessageRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: TongyiToolCall[];
}

type TongyiFinishReason = "stop" | "tool_calls" | "length" | "null" | null;
type TongyiToolChoice =
  | "auto"
  | "none"
  | {
      type: "function";
      function: {
        name: string;
      };
    };

interface TongyiChoiceMessage {
  role?: string;
  content?: string | null;
  tool_calls?: TongyiToolCall[] | null;
}

interface TongyiResponseChoice {
  index?: number;
  finish_reason?: TongyiFinishReason;
  message?: TongyiChoiceMessage;
  delta?: TongyiChoiceMessage;
  tool_calls?: TongyiToolCall[];
}

/**
 * Interface representing a request for a chat completion.
 *
 * See https://help.aliyun.com/zh/dashscope/developer-reference/model-square/
 */
interface ChatCompletionRequest {
  model:
    | (string & NonNullable<unknown>)
    | "qwen-turbo"
    | "qwen-plus"
    | "qwen-max"
    | "qwen-max-1201"
    | "qwen-max-longcontext"
    // 通义千问开源系列
    | "qwen-7b-chat"
    | "qwen-14b-chat"
    | "qwen-72b-chat"
    // LLAMA2
    | "llama2-7b-chat-v2"
    | "llama2-13b-chat-v2"
    // 百川
    | "baichuan-7b-v1"
    | "baichuan2-13b-chat-v1"
    | "baichuan2-7b-chat-v1"
    // ChatGLM
    | "chatglm3-6b"
    | "chatglm-6b-v2";
  input: {
    messages: TongyiMessage[];
  };
  parameters: {
    stream?: boolean;
    result_format?: "text" | "message";
    seed?: number | null;
    max_tokens?: number | null;
    top_p?: number | null;
    top_k?: number | null;
    repetition_penalty?: number | null;
    temperature?: number | null;
    enable_search?: boolean | null;
    incremental_output?: boolean | null;
    parallel_tool_calls?: boolean | null;
    tools?: ToolDefinition[];
    tool_choice?: TongyiToolChoice;
  };
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse {
  code?: string;
  message?: string;
  request_id?: string;
  requestId?: string;
  usage?: {
    output_tokens: number;
    input_tokens: number;
    total_tokens: number;
  };
  output?: {
    text?: string;
    finish_reason?: TongyiFinishReason;
    choices?: TongyiResponseChoice[];
  };
}

export interface ChatAlibabaTongyiCallOptions extends BaseChatModelCallOptions {
  tools?: BindToolsInput[];
  parallel_tool_calls?: boolean;
  parallelToolCalls?: boolean;
}

/**
 * Interface defining the input to the ChatAlibabaTongyi class.
 */
interface AlibabaTongyiChatInput {
  /**
   * Model name to use. Available options are: qwen-turbo, qwen-plus, qwen-max, or Other compatible models.
   * Alias for `model`
   * @default "qwen-turbo"
   */
  modelName: string;

  /** Model name to use. Available options are: qwen-turbo, qwen-plus, qwen-max, or Other compatible models.
   * @default "qwen-turbo"
   */
  model: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  prefixMessages?: TongyiMessage[];

  /**
   * API key to use when making requests. Defaults to the value of
   * `ALIBABA_API_KEY` environment variable.
   */
  alibabaApiKey?: string;

  /**
   * Region for the Alibaba Tongyi API endpoint.
   *
   * Available base URLs (used with `/api/v1/services/aigc/text-generation/generation`):
   * - 'china' (default): https://dashscope.aliyuncs.com/
   * - 'singapore': https://dashscope-intl.aliyuncs.com/
   * - 'us': https://dashscope-us.aliyuncs.com/
   *
   * @default "china"
   */
  region?: "china" | "singapore" | "us";

  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks. Defaults to 0.95.
   */
  temperature?: number;

  /** Total probability mass of tokens to consider at each step. Range
   * from 0 to 1.0. Defaults to 0.8.
   */
  topP?: number;

  topK?: number;

  enableSearch?: boolean;

  maxTokens?: number;

  seed?: number;

  /** Penalizes repeated tokens according to frequency. Range
   * from 1.0 to 2.0. Defaults to 1.0.
   */
  repetitionPenalty?: number;

  /** Experimental passthrough to allow parallel tool calls. */
  parallelToolCalls?: boolean;
}

/**
 * Function that extracts the custom role of a generic chat message.
 * @param message Chat message from which to extract the custom role.
 * @returns The custom role of the chat message.
 */
function extractGenericMessageCustomRole(message: ChatMessage) {
  if (!["system", "assistant", "user", "tool"].includes(message.role)) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as TongyiMessageRole;
}

function normalizeToolCall(rawToolCall: TongyiToolCall): TongyiToolCall {
  const rawArguments = rawToolCall.function?.arguments;
  const normalizedArguments =
    typeof rawArguments === "string"
      ? rawArguments
      : JSON.stringify(rawArguments ?? {});
  return {
    ...rawToolCall,
    function: rawToolCall.function
      ? {
          ...rawToolCall.function,
          arguments: normalizedArguments,
        }
      : undefined,
  };
}

function normalizeToolChoice(
  toolChoice: BaseChatModelCallOptions["tool_choice"] | undefined
): TongyiToolChoice | undefined {
  if (toolChoice === undefined) {
    return undefined;
  }
  if (toolChoice === "auto" || toolChoice === "none") {
    return toolChoice;
  }
  if (toolChoice === "any" || toolChoice === "required") {
    console.warn(
      `ChatAlibabaTongyi received tool_choice="${toolChoice}", which DashScope does not support directly. Falling back to "auto" (forced tool use is not guaranteed).`
    );
    return "auto";
  }
  if (typeof toolChoice === "string") {
    return {
      type: "function",
      function: { name: toolChoice },
    };
  }
  if (typeof toolChoice === "object" && toolChoice !== null) {
    if (
      "type" in toolChoice &&
      toolChoice.type === "function" &&
      "function" in toolChoice &&
      typeof toolChoice.function === "object" &&
      toolChoice.function !== null &&
      "name" in toolChoice.function &&
      typeof toolChoice.function.name === "string"
    ) {
      return {
        type: "function",
        function: {
          name: toolChoice.function.name,
        },
      };
    }
    if (
      "type" in toolChoice &&
      toolChoice.type === "tool" &&
      "name" in toolChoice &&
      typeof toolChoice.name === "string"
    ) {
      return {
        type: "function",
        function: { name: toolChoice.name },
      };
    }
    if ("type" in toolChoice && toolChoice.type === "auto") {
      return "auto";
    }
    if ("type" in toolChoice && toolChoice.type === "none") {
      return "none";
    }
  }
  throw new Error(
    `Unsupported tool_choice value for ChatAlibabaTongyi: ${JSON.stringify(
      toolChoice
    )}`
  );
}

function convertRawToolCallsToToolCallChunks(
  rawToolCalls: TongyiToolCall[]
): ToolCallChunk[] {
  return rawToolCalls.map((rawToolCall) => {
    const normalizedToolCall = normalizeToolCall(rawToolCall);
    return {
      type: "tool_call_chunk",
      id: normalizedToolCall.id,
      name: normalizedToolCall.function?.name,
      args: normalizedToolCall.function?.arguments as string | undefined,
      index: normalizedToolCall.index,
    };
  });
}

function convertRawToolCallsToOpenAIToolCalls(
  rawToolCalls: TongyiToolCall[]
): OpenAIToolCall[] {
  return rawToolCalls.map((rawToolCall, index) => {
    const normalizedToolCall = normalizeToolCall(rawToolCall);
    return {
      id: normalizedToolCall.id ?? `tool_call_${index}`,
      type: "function",
      function: {
        name: normalizedToolCall.function?.name ?? "",
        arguments: (normalizedToolCall.function?.arguments ?? "{}") as string,
      },
      index: normalizedToolCall.index,
    };
  });
}

function mergeToolCallStringValue(
  previousValue: string | undefined,
  deltaValue: string | undefined
): string | undefined {
  if (deltaValue === undefined) {
    return previousValue;
  }
  if (previousValue === undefined) {
    return deltaValue;
  }
  if (deltaValue.startsWith(previousValue)) {
    return deltaValue;
  }
  if (previousValue.endsWith(deltaValue)) {
    return previousValue;
  }
  return `${previousValue}${deltaValue}`;
}

function mergeToolCallDelta(
  existingToolCall: TongyiToolCall | undefined,
  deltaToolCall: TongyiToolCall
): TongyiToolCall {
  const existingArgs = normalizeToolCall(existingToolCall ?? {}).function
    ?.arguments as string | undefined;
  const deltaArgs = normalizeToolCall(deltaToolCall).function?.arguments as
    | string
    | undefined;
  const existingName = existingToolCall?.function?.name;
  const deltaName = deltaToolCall.function?.name;

  return {
    id: mergeToolCallStringValue(existingToolCall?.id, deltaToolCall.id),
    index: deltaToolCall.index ?? existingToolCall?.index,
    type: deltaToolCall.type ?? existingToolCall?.type,
    function: {
      name: mergeToolCallStringValue(existingName, deltaName),
      arguments: mergeToolCallStringValue(existingArgs, deltaArgs),
    },
  };
}

function getToolCallDeltaKey(toolCall: TongyiToolCall, fallbackIndex: number) {
  if (toolCall.index !== undefined) {
    return `index:${toolCall.index}`;
  }
  if (toolCall.id) {
    return `id:${toolCall.id}`;
  }
  return `fallback:${fallbackIndex}`;
}

function applyToolCallDeltas(
  toolCallState: Map<string, TongyiToolCall>,
  deltaToolCalls: TongyiToolCall[]
): TongyiToolCall[] {
  deltaToolCalls.forEach((deltaToolCall, index) => {
    const key = getToolCallDeltaKey(deltaToolCall, index);
    const mergedToolCall = mergeToolCallDelta(
      toolCallState.get(key),
      deltaToolCall
    );
    toolCallState.set(key, mergedToolCall);
  });
  return [...toolCallState.values()];
}

function parseRawToolCalls(rawToolCalls: TongyiToolCall[], partial = false) {
  const toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    type: "tool_call";
    id?: string;
  }> = [];
  const invalidToolCalls: ReturnType<typeof makeInvalidToolCall>[] = [];
  for (const rawToolCall of rawToolCalls) {
    const normalizedToolCall = normalizeToolCall(rawToolCall);
    try {
      const parsedToolCall = parseToolCall(normalizedToolCall, {
        returnId: true,
        partial,
      });
      if (parsedToolCall) {
        toolCalls.push(
          parsedToolCall as {
            name: string;
            args: Record<string, unknown>;
            type: "tool_call";
            id?: string;
          }
        );
      }
    } catch (error) {
      const errorMessage =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Failed to parse tool call";
      invalidToolCalls.push(
        makeInvalidToolCall(normalizedToolCall, errorMessage)
      );
    }
  }
  return { toolCalls, invalidToolCalls };
}

function convertMessagesToTongyiParams(
  messages: BaseMessage[]
): TongyiMessage[] {
  return messages.map((message): TongyiMessage => {
    if (typeof message.content !== "string") {
      throw new Error("Non string message content not supported");
    }
    const completionParam: TongyiMessage = {
      role: messageToTongyiRole(message),
      content: message.content,
    };
    if (AIMessage.isInstance(message) && !!message.tool_calls?.length) {
      completionParam.tool_calls = message.tool_calls.map(
        convertLangChainToolCallToOpenAI
      );
      return completionParam;
    }
    if (message.additional_kwargs.tool_calls != null) {
      completionParam.tool_calls = message.additional_kwargs
        .tool_calls as TongyiToolCall[];
    }
    if ((message as ToolMessage).tool_call_id != null) {
      completionParam.tool_call_id = (message as ToolMessage).tool_call_id;
    }
    return completionParam;
  });
}

function extractOutputMessage(output?: ChatCompletionResponse["output"]): {
  text: string;
  finishReason?: TongyiFinishReason;
  rawToolCalls: TongyiToolCall[];
} {
  if (!output) {
    return { text: "", finishReason: undefined, rawToolCalls: [] };
  }
  if (output.choices?.length) {
    // Keep first-choice semantics in non-stream responses for compatibility.
    const firstChoice = output.choices[0];
    const choiceMessage = firstChoice.message ?? firstChoice.delta;
    return {
      text: choiceMessage?.content ?? "",
      finishReason: firstChoice.finish_reason ?? output.finish_reason,
      rawToolCalls: choiceMessage?.tool_calls ?? firstChoice.tool_calls ?? [],
    };
  }
  return {
    text: output.text ?? "",
    finishReason: output.finish_reason,
    rawToolCalls: [],
  };
}

function extractOutputFromStreamChunk(
  output?: ChatCompletionResponse["output"]
): {
  text: string;
  finishReason?: TongyiFinishReason;
  rawToolCalls: TongyiToolCall[];
} {
  if (!output) {
    return { text: "", finishReason: undefined, rawToolCalls: [] };
  }
  if (output.choices?.length) {
    let text = "";
    let finishReason = output.finish_reason;
    const rawToolCalls: TongyiToolCall[] = [];
    for (const choice of output.choices) {
      const choiceMessage = choice.delta ?? choice.message;
      text += choiceMessage?.content ?? "";
      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }
      if (choiceMessage?.tool_calls?.length) {
        rawToolCalls.push(...choiceMessage.tool_calls);
      } else if (choice.tool_calls?.length) {
        rawToolCalls.push(...choice.tool_calls);
      }
    }
    return { text, finishReason, rawToolCalls };
  }
  return {
    text: output.text ?? "",
    finishReason: output.finish_reason,
    rawToolCalls: [],
  };
}

/**
 * Function that converts a base message to a Tongyi message role.
 * @param message Base message to convert.
 * @returns The Tongyi message role.
 */
function messageToTongyiRole(message: BaseMessage): TongyiMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    case "tool":
      return "tool";
    case "function":
      throw new Error("Function messages not supported");
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Wrapper around Ali Tongyi large language models that use the Chat endpoint.
 *
 * To use you should have the `ALIBABA_API_KEY`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments AlibabaTongyiChatInput
 * @example
 * ```typescript
 * // Default - uses China region
 * const qwen = new ChatAlibabaTongyi({
 *   alibabaApiKey: "YOUR-API-KEY",
 * });
 *
 * // Specify region explicitly
 * const qwen = new ChatAlibabaTongyi({
 *   model: "qwen-turbo",
 *   temperature: 1,
 *   region: "singapore", // or "us" or "china"
 *   alibabaApiKey: "YOUR-API-KEY",
 * });
 *
 * const messages = [new HumanMessage("Hello")];
 *
 * await qwen.call(messages);
 * ```
 */
export class ChatAlibabaTongyi
  extends BaseChatModel<ChatAlibabaTongyiCallOptions>
  implements AlibabaTongyiChatInput
{
  static lc_name() {
    return "ChatAlibabaTongyi";
  }

  get callKeys() {
    return [
      "stop",
      "signal",
      "options",
      "tools",
      "tool_choice",
      "parallel_tool_calls",
      "parallelToolCalls",
    ];
  }

  get lc_secrets() {
    return {
      alibabaApiKey: "ALIBABA_API_KEY",
    };
  }

  get lc_aliases() {
    return undefined;
  }

  lc_serializable: boolean;

  alibabaApiKey?: string;

  streaming: boolean;

  prefixMessages?: TongyiMessage[];

  modelName: ChatCompletionRequest["model"];

  model: ChatCompletionRequest["model"];

  apiUrl: string;

  maxTokens?: number | undefined;

  temperature?: number | undefined;

  topP?: number | undefined;

  topK?: number | undefined;

  repetitionPenalty?: number | undefined;

  seed?: number | undefined;

  enableSearch?: boolean | undefined;

  parallelToolCalls?: boolean | undefined;

  region: "china" | "singapore" | "us";

  /**
   * Get the API URL based on the specified region.
   *
   * @param region - The region to get the URL for ('china', 'singapore', or 'us')
   * @returns The base URL for the specified region
   */
  private getRegionBaseUrl(region: "china" | "singapore" | "us"): string {
    const regionUrls = {
      china: "https://dashscope.aliyuncs.com/",
      singapore: "https://dashscope-intl.aliyuncs.com/",
      us: "https://dashscope-us.aliyuncs.com/",
    };
    return regionUrls[region];
  }

  constructor(
    fields: Partial<AlibabaTongyiChatInput> & BaseChatModelParams = {}
  ) {
    super(fields);

    this.alibabaApiKey =
      fields?.alibabaApiKey ?? getEnvironmentVariable("ALIBABA_API_KEY");
    if (!this.alibabaApiKey) {
      throw new Error("Ali API key not found");
    }

    // Set region (default to china)
    this.region = fields.region ?? "china";

    // Set API URL based on region
    this.apiUrl = `${this.getRegionBaseUrl(this.region)}api/v1/services/aigc/text-generation/generation`;

    this.lc_serializable = true;
    this.streaming = fields.streaming ?? false;
    this.prefixMessages = fields.prefixMessages ?? [];
    this.temperature = fields.temperature;
    this.topP = fields.topP;
    this.topK = fields.topK;
    this.seed = fields.seed;
    this.maxTokens = fields.maxTokens;
    this.repetitionPenalty = fields.repetitionPenalty;
    this.enableSearch = fields.enableSearch;
    this.parallelToolCalls = fields.parallelToolCalls;
    this.modelName = fields?.model ?? fields.modelName ?? "qwen-turbo";
    this.model = this.modelName;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): ChatCompletionRequest["parameters"] {
    const tools =
      options?.tools?.map((tool) => convertToOpenAITool(tool)) ?? [];
    const parallelToolCalls =
      options?.parallel_tool_calls ??
      options?.parallelToolCalls ??
      this.parallelToolCalls;
    const hasTools = tools.length > 0;
    const parameters: ChatCompletionRequest["parameters"] = {
      stream: this.streaming,
      temperature: this.temperature,
      top_p: this.topP,
      top_k: this.topK,
      seed: this.seed,
      max_tokens: this.maxTokens,
      result_format: hasTools ? "message" : "text",
      enable_search: this.enableSearch,
    };
    if (hasTools) {
      parameters.tools = tools;
    }
    if (parallelToolCalls !== undefined) {
      parameters.parallel_tool_calls = parallelToolCalls;
    }
    const toolChoice = normalizeToolChoice(options?.tool_choice);
    if (toolChoice !== undefined) {
      parameters.tool_choice = toolChoice;
    }

    if (this.streaming) {
      parameters.incremental_output = true;
    } else {
      // DashScope generation examples include repetition_penalty in non-stream mode.
      parameters.repetition_penalty = this.repetitionPenalty;
    }

    return parameters;
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams(): ChatCompletionRequest["parameters"] &
    Pick<ChatCompletionRequest, "model"> {
    return {
      model: this.model,
      ...this.invocationParams(),
    };
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<ChatAlibabaTongyiCallOptions>
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    ChatAlibabaTongyiCallOptions
  > {
    return this.withConfig({
      tools,
      ...kwargs,
    });
  }

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>
  ): Runnable<BaseLanguageModelInput, RunOutput>;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>
  ): Runnable<
    BaseLanguageModelInput,
    { raw: AIMessage | AIMessageChunk; parsed: RunOutput }
  >;

  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>,
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
        { raw: AIMessage | AIMessageChunk; parsed: RunOutput }
      > {
    if (config?.strict) {
      throw new Error(`"strict" mode is not supported for this model.`);
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
        `ChatAlibabaTongyi only supports "functionCalling" for structured output.`
      );
    }

    let functionName = name ?? "extract";
    const outputFormatSchema = isInteropZodSchema(schema)
      ? toJsonSchema(schema)
      : schema;
    let tools: ToolDefinition[];
    if (isInteropZodSchema(schema)) {
      tools = [
        {
          type: "function",
          function: {
            name: functionName,
            description,
            parameters: outputFormatSchema,
          },
        },
      ];
    } else {
      if ("name" in schema && typeof schema.name === "string") {
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

    const llm = this.bindTools(tools).withConfig({
      tool_choice: {
        type: "function",
        function: {
          name: functionName,
        },
      },
      ls_structured_output_format: {
        kwargs: { method: "functionCalling" },
        schema: outputFormatSchema,
      },
    });
    const outputParser = RunnableLambda.from<
      AIMessage | AIMessageChunk,
      RunOutput
    >((input) => {
      const toolCalls = input.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        throw new Error("No tool calls found in the response.");
      }
      const toolCall = toolCalls.find((tc) => tc.name === functionName);
      if (!toolCall) {
        throw new Error(`No tool call found with name ${functionName}.`);
      }
      return toolCall.args as RunOutput;
    });

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "StructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, cfg) => outputParser.invoke(input.raw, cfg),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });

    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: AIMessage | AIMessageChunk; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "StructuredOutputRunnable",
    });
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const parameters = this.invocationParams(options);
    const messagesMapped = convertMessagesToTongyiParams(messages);

    const data = parameters.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse | undefined;
          let concatenatedText = "";
          let mergedToolCalls: TongyiToolCall[] = [];
          const streamedToolCallState = new Map<string, TongyiToolCall>();
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              model: this.model,
              parameters,
              input: {
                messages: messagesMapped,
              },
            },
            true,
            options?.signal,
            (event) => {
              const data: ChatCompletionResponse = JSON.parse(event.data);
              if (data?.code) {
                if (rejected) {
                  return;
                }
                rejected = true;
                reject(new Error(data?.message));
                return;
              }

              const { text, finishReason, rawToolCalls } =
                extractOutputFromStreamChunk(data.output);
              concatenatedText += text;
              mergedToolCalls = applyToolCallDeltas(
                streamedToolCallState,
                rawToolCalls
              );

              if (!response) {
                response = {
                  ...data,
                  output: {
                    ...(data.output ?? {}),
                    text: concatenatedText,
                    finish_reason: finishReason,
                    choices: [
                      {
                        finish_reason: finishReason,
                        message: {
                          role: "assistant",
                          content: concatenatedText,
                          tool_calls: mergedToolCalls,
                        },
                      },
                    ],
                  },
                };
              } else {
                response.output = {
                  ...(response.output ?? {}),
                  text: concatenatedText,
                  finish_reason: finishReason ?? response.output?.finish_reason,
                  choices: [
                    {
                      finish_reason:
                        finishReason ?? response.output?.finish_reason,
                      message: {
                        role: "assistant",
                        content: concatenatedText,
                        tool_calls: mergedToolCalls,
                      },
                    },
                  ],
                };
                response.usage = data.usage;
              }

              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(text ?? "");
              if (finishReason && finishReason !== "null") {
                if (resolved || rejected) {
                  return;
                }
                resolved = true;
                resolve(
                  response ?? {
                    ...data,
                    output: {
                      ...(data.output ?? {}),
                      text: concatenatedText,
                      finish_reason: finishReason,
                    },
                  }
                );
              }
            }
          )
            .then(() => {
              if (resolved || rejected) {
                return;
              }
              resolved = true;
              resolve(
                response ?? {
                  usage: {
                    input_tokens: 0,
                    output_tokens: 0,
                    total_tokens: 0,
                  },
                  output: {
                    text: concatenatedText,
                    finish_reason: "null",
                    choices: [
                      {
                        finish_reason: "null",
                        message: {
                          role: "assistant",
                          content: concatenatedText,
                          tool_calls: mergedToolCalls,
                        },
                      },
                    ],
                  },
                }
              );
            })
            .catch((error) => {
              if (!rejected) {
                rejected = true;
                reject(error);
              }
            });
        })
      : await this.completionWithRetry(
          {
            model: this.model,
            parameters,
            input: {
              messages: messagesMapped,
            },
          },
          false,
          options?.signal
        ).then<ChatCompletionResponse>((data) => {
          if (data?.code) {
            throw new Error(data?.message);
          }

          return data;
        });

    const {
      input_tokens = 0,
      output_tokens = 0,
      total_tokens = 0,
    } = data.usage ?? {};
    const usageMetadata: UsageMetadata = {
      input_tokens,
      output_tokens,
      total_tokens,
    };
    const { text, finishReason, rawToolCalls } = extractOutputMessage(
      data.output
    );
    const requestId = data.request_id ?? data.requestId;
    const { toolCalls, invalidToolCalls } = parseRawToolCalls(rawToolCalls);
    const isToolResponse = rawToolCalls.length > 0;
    const message = isToolResponse
      ? new AIMessage({
          content: text,
          additional_kwargs: {
            tool_calls: convertRawToolCallsToOpenAIToolCalls(rawToolCalls),
          },
          tool_calls: toolCalls,
          invalid_tool_calls: invalidToolCalls,
          usage_metadata: usageMetadata,
          response_metadata: {
            model_provider: "alibaba_tongyi",
            model: this.model,
            request_id: requestId,
            ...(finishReason ? { finish_reason: finishReason } : {}),
          },
        })
      : new AIMessage({
          content: text,
          usage_metadata: usageMetadata,
          response_metadata: {
            model_provider: "alibaba_tongyi",
            model: this.model,
            request_id: requestId,
            ...(finishReason ? { finish_reason: finishReason } : {}),
          },
        });

    return {
      generations: [
        {
          text,
          message,
          generationInfo: finishReason
            ? { finish_reason: finishReason }
            : undefined,
        },
      ],
      llmOutput: {
        tokenUsage: {
          promptTokens: input_tokens,
          completionTokens: output_tokens,
          totalTokens: total_tokens,
        },
      },
    };
  }

  /** @ignore */
  async completionWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal,
    onmessage?: (event: MessageEvent) => void
  ) {
    const makeCompletionRequest = async () => {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          ...(stream
            ? {
                Accept: "text/event-stream",
                "X-DashScope-SSE": "enable",
              }
            : {}),
          Authorization: `Bearer ${this.alibabaApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal,
      });

      if (!stream) {
        return response.json();
      }

      if (response.body) {
        // response will not be a stream if an error occurred
        if (
          !response.headers.get("content-type")?.startsWith("text/event-stream")
        ) {
          onmessage?.(
            new MessageEvent("message", {
              data: await response.text(),
            })
          );
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let data = "";
        let continueReading = true;
        while (continueReading) {
          const { done, value } = await reader.read();
          if (done) {
            continueReading = false;
            break;
          }
          data += decoder.decode(value);
          let continueProcessing = true;
          while (continueProcessing) {
            const newlineIndex = data.indexOf("\n");
            if (newlineIndex === -1) {
              continueProcessing = false;
              break;
            }
            const line = data.slice(0, newlineIndex);
            data = data.slice(newlineIndex + 1);
            if (line.startsWith("data:")) {
              const event = new MessageEvent("message", {
                data: line.slice("data:".length).trim(),
              });
              onmessage?.(event);
            }
          }
        }
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const parameters = {
      ...this.invocationParams(options),
      stream: true,
      incremental_output: true,
    };

    const messagesMapped = convertMessagesToTongyiParams(messages);

    const stream = await this.caller.call(async () =>
      this.createTongyiStream(
        {
          model: this.model,
          parameters,
          input: {
            messages: messagesMapped,
          },
        },
        options?.signal
      )
    );

    for await (const chunk of stream) {
      /* if some error occurs:
         {
          "code": "DataInspectionFailed",
          "message": "Output data may contain inappropriate content.",
          "request_id": "43d18007-5aa5-9d18-b3b3-a55aba9ce8cb"
        }
      */
      if (!chunk.output && chunk.code) {
        throw new Error(JSON.stringify(chunk));
      }
      const { text, finishReason, rawToolCalls } = extractOutputFromStreamChunk(
        chunk.output
      );
      const toolCallChunks = convertRawToolCallsToToolCallChunks(rawToolCalls);
      const requestId = chunk.request_id ?? chunk.requestId;
      const usageMetadata: UsageMetadata | undefined = chunk.usage
        ? {
            input_tokens: chunk.usage.input_tokens ?? 0,
            output_tokens: chunk.usage.output_tokens ?? 0,
            total_tokens: chunk.usage.total_tokens ?? 0,
          }
        : undefined;
      yield new ChatGenerationChunk({
        text,
        message: new AIMessageChunk({
          content: text,
          tool_call_chunks: toolCallChunks,
          usage_metadata: usageMetadata,
          response_metadata: {
            model_provider: "alibaba_tongyi",
            model: this.model,
            request_id: requestId,
            ...(finishReason ? { finish_reason: finishReason } : {}),
          },
        }),
        generationInfo:
          finishReason === "stop" || finishReason === "tool_calls"
            ? {
                finish_reason: finishReason,
                request_id: requestId,
                usage: chunk.usage,
              }
            : undefined,
      });
      await runManager?.handleLLMNewToken(text);
    }
  }

  private async *createTongyiStream(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.alibabaApiKey}`,
        Accept: "text/event-stream",
        "X-DashScope-SSE": "enable",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      let error;
      const responseText = await response.text();
      try {
        const json = JSON.parse(responseText);
        error = new Error(
          `Tongyi call failed with status code ${response.status}: ${json.error}`
        );
      } catch {
        error = new Error(
          `Tongyi call failed with status code ${response.status}: ${responseText}`
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }
    if (!response.body) {
      throw new Error(
        "Could not begin Tongyi stream. Please check the given URL and try again."
      );
    }
    const stream = IterableReadableStream.fromReadableStream(response.body);
    const decoder = new TextDecoder();
    let extra = "";
    for await (const chunk of stream) {
      const decoded = extra + decoder.decode(chunk);
      const lines = decoded.split("\n");
      extra = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) {
          continue;
        }
        try {
          yield JSON.parse(line.slice("data:".length).trim());
        } catch {
          console.warn(`Received a non-JSON parseable chunk: ${line}`);
        }
      }
    }
  }

  _llmType(): string {
    return "alibaba_tongyi";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
