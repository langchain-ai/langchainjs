import {
  AIMessage,
  AIMessageChunk,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessageChunk,
  HumanMessageChunk,
  isAIMessage,
  MessageType,
  ToolMessageChunk,
  UsageMetadata,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  BaseLanguageModelInput,
  FunctionDefinition,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  BaseChatModel,
  BindToolsInput,
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import {
  DeploymentsTextChatParams,
  RequestCallbacks,
  TextChatMessagesTextChatMessageAssistant,
  TextChatParameterTools,
  TextChatParams,
  TextChatResponse,
  TextChatResponseFormat,
  TextChatResultChoice,
  TextChatResultMessage,
  TextChatToolCall,
  TextChatUsage,
} from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import { WatsonXAI, Stream } from "@ibm-cloud/watsonx-ai";
import { Response } from "@ibm-cloud/watsonx-ai/base";
import {
  convertLangChainToolCallToOpenAI,
  makeInvalidToolCall,
  parseToolCall,
} from "@langchain/core/output_parsers/openai_tools";
import { ToolCallChunk } from "@langchain/core/messages/tool";
import {
  Runnable,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  BaseLLMOutputParser,
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  JsonSchema7Type,
  toJsonSchema,
} from "@langchain/core/utils/json_schema";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  ChatObjectStream,
  ChatsChoice,
  ChatsMessage,
  ChatsRequestTool,
  ChatsResponse,
  CreateChatCompletionsParams,
  Gateway,
} from "@ibm-cloud/watsonx-ai/gateway";
import { WatsonxAuth, XOR, WatsonxBaseChatParams } from "../types/ibm.js";
import {
  _convertToolCallIdToMistralCompatible,
  authenticateAndSetGatewayInstance,
  authenticateAndSetInstance,
  checkValidProps,
  expectOneOf,
  WatsonxToolsOutputParser,
} from "../utils/ibm.js";

// Ensuring back compatibility
export interface WatsonxCallParams extends WatsonxCallOptionsChat {}
export interface WatsonxCallDeployedParams extends DeploymentsTextChatParams {}

export interface WatsonxDeltaStream {
  role?: string;
  content?: string;
  tool_calls?: TextChatToolCall[];
  refusal?: string;
}

/** Project/space params */

export interface WatsonxCallOptionsChat
  extends
    Partial<Omit<TextChatParams, "modelId" | "toolChoice" | "messages">>,
    WatsonxBaseChatParams {
  model?: string;
}

export interface WatsonxProjectSpaceParams extends WatsonxCallOptionsChat {
  model: string;
  serviceUrl: string;
  version: string;
}
/** Deployed params */
export interface WatsonxCallOptionsDeployedChat
  extends
    Partial<Omit<DeploymentsTextChatParams, "messages">>,
    WatsonxBaseChatParams {}

export interface WatsonxDeployedParams extends WatsonxCallOptionsDeployedChat {
  serviceUrl: string;
  version: string;
}
/** Gateway params */
export interface WatsonxGatewayChatKwargs extends Omit<
  CreateChatCompletionsParams,
  keyof TextChatParams | "model" | "stream" | "messages"
> {}
export interface WatsonxCallOptionsGatewayChat
  extends
    Omit<
      CreateChatCompletionsParams,
      | "stream"
      | "toolChoice"
      | "messages"
      | "prompt"
      | keyof WatsonxGatewayChatKwargs
    >,
    WatsonxBaseChatParams {
  /** Additional parameters usable only in model gateway */
  modelGatewayKwargs?: WatsonxGatewayChatKwargs;
}

export interface WatsonxGatewayChatParams extends WatsonxCallOptionsGatewayChat {
  serviceUrl: string;
  version: string;
}

// Chat input for different chat modes
export interface ChatWatsonxInput
  extends BaseChatModelParams, WatsonxProjectSpaceParams {}

export interface ChatWatsonxDeployedInput
  extends BaseChatModelParams, WatsonxDeployedParams {}

export interface ChatWatsonxGatewayInput
  extends BaseChatModelParams, WatsonxGatewayChatParams {
  /** Flag indicating weather to use Model Gateway or no */
  modelGateway: boolean;
}

// Chat type to be extended by chat class
export type ChatWatsonxConstructor = BaseChatModelParams &
  Partial<WatsonxBaseChatParams> &
  WatsonxDeployedParams &
  WatsonxCallParams &
  WatsonxDeployedParams;

function _convertToValidToolId(model: string, tool_call_id: string): string {
  if (model.startsWith("mistralai") && tool_call_id)
    return _convertToolCallIdToMistralCompatible(tool_call_id);
  return tool_call_id;
}

type ChatWatsonxToolType =
  | BindToolsInput
  | TextChatParameterTools
  | ChatsRequestTool;

function _convertToolToWatsonxTool(
  tools: ChatWatsonxToolType[]
): WatsonXAI.TextChatParameterTools[] {
  return tools.map((tool) => {
    if ("type" in tool) {
      return tool as WatsonXAI.TextChatParameterTools;
    }
    // Check if schema is a Zod schema or already a JSON schema
    const parameters = isInteropZodSchema(tool.schema)
      ? toJsonSchema(tool.schema)
      : tool.schema;

    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? `Tool: ${tool.name}`,
        parameters,
      },
    };
  });
}
const MESSAGE_TYPE_TO_ROLE_MAP: Record<MessageType, string> = {
  human: "user",
  ai: "assistant",
  system: "system",
  tool: "tool",
  function: "function",
  generic: "assistant",
  developer: "developer",
  remove: "function",
};

const getRole = (role: MessageType): string => {
  const watsonRole = MESSAGE_TYPE_TO_ROLE_MAP[role];
  if (!watsonRole) {
    throw new Error(`Unknown message type: ${role}`);
  }
  return watsonRole;
};

const getToolCalls = (message: BaseMessage, model?: string) => {
  if (isAIMessage(message) && message.tool_calls?.length) {
    return message.tool_calls
      .map((toolCall) => ({
        ...toolCall,
        id: _convertToValidToolId(model ?? "", toolCall.id ?? ""),
      }))
      .map(convertLangChainToolCallToOpenAI);
  }
  return undefined;
};

function _convertMessagesToWatsonxMessages(
  messages: BaseMessage[],
  model?: string
): TextChatResultMessage[] | ChatsMessage[] {
  return messages.map((message) => {
    const toolCalls = getToolCalls(message, model);
    const content = toolCalls === undefined ? message.content : "";
    if ("tool_call_id" in message && typeof message.tool_call_id === "string") {
      return {
        role: getRole(message.getType()),
        content,
        name: message.name,
        tool_call_id: _convertToValidToolId(model ?? "", message.tool_call_id),
      };
    }

    return {
      role: getRole(message.getType()),
      content,
      tool_calls: toolCalls,
    };
  });
}

function _watsonxResponseToChatMessage(
  choice: TextChatResultChoice | ChatsChoice,
  rawDataId: string,
  usage?: TextChatUsage
): BaseMessage {
  const { message } = choice;
  if (!message) throw new Error("No message presented");
  const rawToolCalls = message.tool_calls ?? [];

  switch (message.role) {
    case "assistant": {
      const toolCalls = [];
      const invalidToolCalls = [];
      for (const rawToolCall of rawToolCalls) {
        try {
          const parsed = parseToolCall(rawToolCall, { returnId: true });
          toolCalls.push(parsed);
        } catch (e: unknown) {
          invalidToolCalls.push(
            makeInvalidToolCall(rawToolCall, (e as Error).message)
          );
        }
      }
      const additional_kwargs: Record<string, unknown> = {
        tool_calls: rawToolCalls.map((toolCall) => ({
          ...toolCall,
          type: "function",
        })),
        ...("reasoning_content" in message
          ? { reasoning: message?.reasoning_content }
          : {}),
      };

      return new AIMessage({
        id: rawDataId,
        content: message.content ?? "",
        tool_calls: toolCalls,
        invalid_tool_calls: invalidToolCalls,
        additional_kwargs,
        usage_metadata: usage
          ? {
              input_tokens: usage.prompt_tokens ?? 0,
              output_tokens: usage.completion_tokens ?? 0,
              total_tokens: usage.total_tokens ?? 0,
            }
          : undefined,
      });
    }
    default:
      return new ChatMessage(message.content ?? "", message.role ?? "unknown");
  }
}

function _convertDeltaToMessageChunk(
  helperIndex: { ["value"]: number },
  delta: WatsonxDeltaStream,
  rawData: TextChatResponse | ChatsResponse,
  model?: string,
  usage?: TextChatUsage,
  defaultRole?: TextChatMessagesTextChatMessageAssistant.Constants.Role
) {
  if (delta.refusal) throw new Error(delta.refusal);

  const rawToolCalls = delta.tool_calls?.length
    ? delta.tool_calls?.map(
        (
          toolCall,
          index
        ): TextChatToolCall & { index: number; type: "function" } => {
          const validId =
            toolCall.id && toolCall.id !== ""
              ? _convertToValidToolId(model ?? "", toolCall.id)
              : undefined;
          if (toolCall.id) helperIndex.value += 1;
          return {
            index:
              delta?.tool_calls && delta?.tool_calls?.length > 1
                ? index
                : helperIndex.value,
            ...toolCall,
            ...(validId !== null && { id: validId }),
            type: "function",
          };
        }
      )
    : undefined;

  const role = delta.role || defaultRole || "assistant";
  const content = delta.content ?? "";
  const additional_kwargs = {
    ...(rawToolCalls ? { tool_calls: rawToolCalls } : {}),
    ...("reasoning_content" in delta
      ? { reasoning: delta?.reasoning_content }
      : {}),
  };

  const usageMetadata = {
    input_tokens: usage?.prompt_tokens ?? 0,
    output_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };
  switch (role) {
    case "user":
      return new HumanMessageChunk({ content });

    case "assistant": {
      // Extract tool call chunks creation
      const toolCallChunks: ToolCallChunk[] = [];
      if (rawToolCalls && rawToolCalls?.length > 0) {
        for (const rawToolCallChunk of rawToolCalls) {
          const toolCallName = rawToolCallChunk.function.name;
          toolCallChunks.push({
            name: toolCallName.length > 0 ? toolCallName : undefined,
            args: rawToolCallChunk.function?.arguments,
            id: rawToolCallChunk.id,
            index: rawToolCallChunk.index,
            type: "tool_call_chunk",
          });
        }
      }

      return new AIMessageChunk({
        content,
        tool_call_chunks: toolCallChunks,
        additional_kwargs,
        usage_metadata: usageMetadata,
        id: rawData.id,
      });
    }

    case "tool":
      if (rawToolCalls) {
        return new ToolMessageChunk({
          content,
          additional_kwargs,
          tool_call_id: _convertToValidToolId(model ?? "", rawToolCalls[0].id),
        });
      }
      return null;

    case "function":
      return new FunctionMessageChunk({
        content,
        additional_kwargs,
      });

    default:
      return new ChatMessageChunk({ content, role });
  }
}

function _convertToolChoiceToWatsonxToolChoice(
  toolChoice: TextChatParameterTools | string | "auto" | "any"
) {
  if (typeof toolChoice === "string") {
    if (toolChoice === "any" || toolChoice === "required") {
      return { toolChoiceOption: "required" };
    } else if (toolChoice === "auto" || toolChoice === "none") {
      return { toolChoiceOption: toolChoice };
    } else {
      return {
        toolChoice: {
          type: "function",
          function: { name: toolChoice },
        },
      };
    }
  } else if ("type" in toolChoice) return { toolChoice };
  else
    throw new Error(
      `Unrecognized tool_choice type. Expected string or TextChatParameterTools. Recieved ${toolChoice}`
    );
}

// Combined input for chat excluding each mode to not be present at the same time
export type ChatWatsonxConstructorInput = XOR<
  XOR<ChatWatsonxInput, ChatWatsonxDeployedInput>,
  ChatWatsonxGatewayInput
> &
  WatsonxAuth;

// Helper to force type expansion
export type ChatWatsonxCallOptions = XOR<
  XOR<WatsonxCallOptionsChat, WatsonxCallOptionsDeployedChat>,
  WatsonxCallOptionsGatewayChat
>;

export class ChatWatsonx<
  CallOptions extends ChatWatsonxCallOptions = ChatWatsonxCallOptions,
>
  extends BaseChatModel<CallOptions>
  implements ChatWatsonxConstructor
{
  static lc_name() {
    return "ChatWatsonx";
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } {
    return {
      authenticator: "AUTHENTICATOR",
      apiKey: "WATSONX_AI_APIKEY",
      apikey: "WATSONX_AI_APIKEY",
      watsonxAIAuthType: "WATSONX_AI_AUTH_TYPE",
      watsonxAIApikey: "WATSONX_AI_APIKEY",
      watsonxAIBearerToken: "WATSONX_AI_BEARER_TOKEN",
      watsonxAIUsername: "WATSONX_AI_USERNAME",
      watsonxAIPassword: "WATSONX_AI_PASSWORD",
      watsonxAIUrl: "WATSONX_AI_URL",
    };
  }

  get lc_aliases(): { [key: string]: string } {
    return {
      authenticator: "authenticator",
      apikey: "watsonx_ai_apikey",
      apiKey: "watsonx_ai_apikey",
      watsonxAIAuthType: "watsonx_ai_auth_type",
      watsonxAIApikey: "watsonx_ai_apikey",
      watsonxAIBearerToken: "watsonx_ai_bearer_token",
      watsonxAIUsername: "watsonx_ai_username",
      watsonxAIPassword: "watsonx_ai_password",
      watsonxAIUrl: "watsonx_ai_url",
    };
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = this.invocationParams(options);
    return {
      ls_provider: "watsonx",
      ls_model_name: this.model,
      ls_model_type: "chat",
      ls_temperature: params.temperature ?? undefined,
      ls_max_tokens: params.maxTokens ?? undefined,
    };
  }

  private checkValidProperties(
    fields: this["ParsedCallOptions"] | ChatWatsonxConstructorInput
  ) {
    const PROPERTY_GROUPS = {
      ALWAYS_ALLOWED: [
        "headers",
        "signal",
        "tool_choice",
        "promptIndex",
        "ls_structured_output_format",
        "watsonxCallbacks",
        "writer",
        "interrupt",
      ],

      AUTH: [
        "serviceUrl",
        "watsonxAIApikey",
        "watsonxAIBearerToken",
        "watsonxAIUsername",
        "watsonxAIPassword",
        "watsonxAIUrl",
        "watsonxAIAuthType",
        "disableSSL",
      ],

      SHARED: [
        "maxRetries",
        "authenticator",
        "serviceUrl",
        "version",
        "streaming",
        "callbackManager",
        "callbacks",
        "maxConcurrency",
        "cache",
        "metadata",
        "concurrency",
        "onFailedAttempt",
        "verbose",
        "tags",
        "headers",
        "disableStreaming",
        "timeout",
        "stopSequences",
      ],

      GATEWAY: [
        "tools",
        "frequencyPenalty",
        "logitBias",
        "logprobs",
        "topLogprobs",
        "maxTokens",
        "n",
        "presencePenalty",
        "responseFormat",
        "seed",
        "stop",
        "temperature",
        "topP",
        "model",
        "modelGatewayKwargs",
        "modelGateway",
        "reasoningEffort",
      ],

      DEPLOYMENT: ["idOrName"],

      PROJECT_OR_SPACE: [
        "spaceId",
        "projectId",
        "tools",
        "toolChoiceOption",
        "frequencyPenalty",
        "logitBias",
        "logprobs",
        "topLogprobs",
        "maxTokens",
        "maxCompletionTokens",
        "n",
        "presencePenalty",
        "responseFormat",
        "seed",
        "stop",
        "temperature",
        "topP",
        "timeLimit",
        "model",
        "reasoningEffort",
        "includeReasoning",
      ],
    };

    const validProps: string[] = [
      ...PROPERTY_GROUPS.ALWAYS_ALLOWED,
      ...PROPERTY_GROUPS.AUTH,
      ...PROPERTY_GROUPS.SHARED,
    ];

    if (this.modelGateway) {
      validProps.push(...PROPERTY_GROUPS.GATEWAY);
    } else if (this.idOrName) {
      validProps.push(...PROPERTY_GROUPS.DEPLOYMENT);
    } else if (this.spaceId || this.projectId) {
      validProps.push(...PROPERTY_GROUPS.PROJECT_OR_SPACE);
    }

    checkValidProps(fields, validProps);
  }

  protected service?: WatsonXAI;

  protected gateway?: Gateway;

  model?: string;

  version = "2024-05-31";

  modelGateway = false;

  maxTokens?: number;

  maxCompletionTokens?: number;

  maxRetries = 0;

  serviceUrl: string;

  spaceId?: string;

  projectId?: string;

  idOrName?: string;

  frequencyPenalty?: number;

  logprobs?: boolean;

  topLogprobs?: number;

  n?: number;

  presencePenalty?: number;

  temperature?: number;

  topP?: number;

  timeLimit?: number;

  includeReasoning?: boolean;

  reasoningEffort?: "low" | "medium" | "high";

  maxConcurrency?: number;

  responseFormat?: TextChatResponseFormat;

  streaming = false;

  modelGatewayKwargs?: WatsonxGatewayChatKwargs;

  watsonxCallbacks?: RequestCallbacks;

  constructor(fields: ChatWatsonxConstructorInput) {
    super(fields);
    const uniqueProps = ["spaceId", "projectId", "idOrName", "modelGateway"];
    expectOneOf(fields, uniqueProps, true);

    this.idOrName = fields?.idOrName;
    this.projectId = fields?.projectId;
    this.modelGateway = fields.modelGateway || this.modelGateway;
    this.spaceId = fields?.spaceId;

    this.checkValidProperties(fields);

    this.model = fields?.model ?? this.model;
    this.projectId = fields?.projectId;
    this.spaceId = fields?.spaceId;
    this.watsonxCallbacks = fields?.watsonxCallbacks;
    this.serviceUrl = fields?.serviceUrl;
    this.version = fields?.version ?? this.version;

    this.temperature = fields?.temperature;
    this.maxRetries = fields?.maxRetries || this.maxRetries;
    this.maxConcurrency = fields?.maxConcurrency;
    this.frequencyPenalty = fields?.frequencyPenalty;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.maxCompletionTokens = fields?.maxCompletionTokens;
    this.presencePenalty = fields?.presencePenalty;
    this.topP = fields?.topP;
    this.responseFormat = fields?.responseFormat ?? this.responseFormat;
    this.streaming = fields?.streaming ?? this.streaming;
    this.n = fields?.n ?? this.n;
    this.timeLimit = fields?.timeLimit;
    this.reasoningEffort = fields?.reasoningEffort;
    this.includeReasoning = fields?.includeReasoning;

    this.modelGateway = fields?.modelGateway ?? this.modelGateway;
    this.modelGatewayKwargs = fields?.modelGatewayKwargs;

    const {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    } = fields;

    const authData = {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    };

    if (this.modelGateway) {
      const chatGateway = authenticateAndSetGatewayInstance(authData);
      if (chatGateway) this.gateway = chatGateway;
      else throw new Error("You have not provided any type of authentication");
    } else {
      const service = authenticateAndSetInstance(authData);

      if (service) this.service = service;
      else throw new Error("You have not provided any type of authentication");
    }
  }

  _llmType() {
    return "watsonx";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const { tools, responseFormat, timeLimit, tool_choice } = options;

    expectOneOf(options, ["spaceId", "projectId", "idOrName", "modelGateway"]);

    const paramDefaults = {
      maxTokens: options.maxTokens ?? this.maxTokens,
      maxCompletionTokens:
        options.maxCompletionTokens ?? this.maxCompletionTokens,
      temperature: options.temperature ?? this.temperature,
      topP: options.topP ?? this.topP,
      presencePenalty: options.presencePenalty ?? this.presencePenalty,
      n: options.n ?? this.n,
      topLogprobs: options.topLogprobs ?? this.topLogprobs,
      logprobs: options.logprobs ?? this.logprobs,
      frequencyPenalty: options.frequencyPenalty ?? this.frequencyPenalty,
      reasoningEffort: options.reasoningEffort ?? this.reasoningEffort,
    };

    const toolParams: Record<string, WatsonXAI.TextChatParameterTools[]> = tools
      ? { tools: _convertToolToWatsonxTool(tools) }
      : {};

    const toolChoiceParams: Record<
      string,
      TextChatParameterTools | string | undefined
    > = tool_choice ? _convertToolChoiceToWatsonxToolChoice(tool_choice) : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gatewayParams: Record<string, any> = this.modelGateway
      ? { ...this.modelGatewayKwargs }
      : {
          timeLimit: timeLimit ?? this.timeLimit,
          projectId: options.projectId ?? this.projectId,
          includeReasoning: options.includeReasoning ?? this.includeReasoning,
        };

    return {
      ...paramDefaults,
      ...toolParams,
      responseFormat,
      ...toolChoiceParams,
      ...gatewayParams,
    };
  }

  invocationCallbacks(options: this["ParsedCallOptions"]) {
    return options.watsonxCallbacks ?? this.watsonxCallbacks;
  }

  override bindTools(
    tools: ChatWatsonxToolType[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, CallOptions> {
    return this.withConfig({
      tools: _convertToolToWatsonxTool(tools),
      ...kwargs,
    } as CallOptions);
  }

  scopeId(
    options?: this["ParsedCallOptions"]
  ):
    | { idOrName: string }
    | { projectId: string; modelId: string }
    | { spaceId: string; modelId: string }
    | { modelId: string }
    | { model: string } {
    const model = options?.model ?? this.model;
    const projectId = options?.projectId ?? this.projectId;
    const spaceId = options?.spaceId ?? this.spaceId;
    const idOrName = options?.idOrName ?? this.idOrName;

    if (this.modelGateway) {
      if (!model) {
        throw new Error(
          "No model provided! Model gateway expects model to be provided"
        );
      }
      return { model };
    }

    if (projectId && model) return { projectId, modelId: model };
    if (spaceId && model) return { spaceId, modelId: model };
    if (idOrName) return { idOrName };
    if (model) return { modelId: model };

    throw new Error("No id or model provided!");
  }

  async completionWithRetry<T>(
    callback: () => T,
    options?: this["ParsedCallOptions"]
  ) {
    const caller = new AsyncCaller({
      maxConcurrency: options?.maxConcurrency ?? this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const result = options
      ? caller.callWithOptions(
          {
            signal: options.signal,
          },
          async () => callback()
        )
      : caller.call(async () => callback());

    return result;
  }

  private async _chatModelGateway<S extends boolean = false>(
    scopeId: ReturnType<ChatWatsonx["scopeId"]>,
    params: ReturnType<ChatWatsonx["invocationParams"]>,
    messages: ChatsMessage[],
    signal?: AbortSignal,
    stream: S = false as S
  ): Promise<
    S extends true ? Stream<ChatObjectStream> : Response<ChatsResponse>
  > {
    if (this.gateway) {
      if ("model" in scopeId) {
        return this.gateway.chat.completion.create({
          ...params,
          ...scopeId,
          signal,
          stream,
          ...(stream ? { returnObject: true } : {}),
          messages,
        });
      }
      throw new Error(
        "No 'model' specified. Model needs to be spcified for model gateway"
      );
    }
    throw new Error(
      "'gateway' instance is not set. Please check your implementation"
    );
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      const finalChunks: Record<number, ChatGenerationChunk> = {};
      let tokenUsage: UsageMetadata = {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
      };
      const tokenUsages: UsageMetadata[] = [];
      for await (const chunk of stream) {
        const message = chunk.message as AIMessageChunk;
        const usageMetadata = message?.usage_metadata as UsageMetadata;
        if (usageMetadata) {
          const completion = chunk.generationInfo?.completion;
          if (tokenUsages[completion])
            tokenUsages[completion].output_tokens =
              usageMetadata?.output_tokens;
          else tokenUsages[completion] = usageMetadata;
        }
        chunk.message.response_metadata = {
          model: this.model,
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };

        const index =
          (chunk.generationInfo as NewTokenIndices)?.completion ?? 0;
        if (finalChunks[index] === undefined) {
          finalChunks[index] = chunk;
        } else {
          finalChunks[index] = finalChunks[index].concat(chunk);
        }
      }
      tokenUsage = tokenUsages.reduce((acc, curr) => {
        return {
          input_tokens: acc.input_tokens + curr.input_tokens,
          output_tokens: acc.output_tokens + curr.output_tokens,
          total_tokens: acc.total_tokens + curr.total_tokens,
        };
      });
      const generations = Object.entries(finalChunks)
        .sort(([aKey], [bKey]) => parseInt(aKey, 10) - parseInt(bKey, 10))
        .map(([_, value]) => value);
      return { generations, llmOutput: { tokenUsage } };
    } else {
      const params = this.invocationParams(options);
      const scopeId = this.scopeId(options);
      const watsonxCallbacks = this.invocationCallbacks(options);
      const watsonxMessages = _convertMessagesToWatsonxMessages(
        messages,
        this.model
      );
      const callback = () => {
        if (this.modelGateway) {
          return this._chatModelGateway(
            scopeId,
            params,
            watsonxMessages,
            options.signal,
            false
          );
        }

        if (this.service) {
          if ("idOrName" in scopeId) {
            return this.service.deploymentsTextChat(
              {
                ...scopeId,
                messages: watsonxMessages,
                signal: options?.signal,
              },
              watsonxCallbacks
            );
          }

          if ("modelId" in scopeId)
            return this.service.textChat(
              {
                ...params,
                ...scopeId,
                messages: watsonxMessages,
                signal: options?.signal,
              },
              watsonxCallbacks
            );
        }

        throw new Error(
          "No service or gateway set. Please check your intsance init"
        );
      };

      const { result } = await this.completionWithRetry(callback, options);
      const generations: ChatGeneration[] = [];
      for (const part of result.choices) {
        const generation: ChatGeneration = {
          text: part.message?.content ?? "",
          message: _watsonxResponseToChatMessage(
            part,
            result.id,
            result?.usage
          ),
        };
        if (part.finish_reason) {
          generation.generationInfo = { finish_reason: part.finish_reason };
        }
        generations.push(generation);
      }

      return {
        generations,
        llmOutput: {
          tokenUsage: result?.usage,
          model_name: this.model,
          model: this.model,
        },
      };
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.invocationParams(options);
    const scopeId = this.scopeId(options);
    const watsonxMessages = _convertMessagesToWatsonxMessages(
      messages,
      this.model
    );
    const watsonxCallbacks = this.invocationCallbacks(options);
    const { signal } = options;
    const callback = () => {
      if (this.modelGateway) {
        return this._chatModelGateway(
          scopeId,
          params,
          watsonxMessages,
          signal,
          true
        );
      }
      if (this.service) {
        if ("idOrName" in scopeId)
          return this.service.deploymentsTextChatStream(
            {
              ...scopeId,
              messages: watsonxMessages,
              returnObject: true,
              signal,
            },
            watsonxCallbacks
          );
        if ("modelId" in scopeId)
          return this.service.textChatStream(
            {
              ...params,
              ...scopeId,
              messages: watsonxMessages,
              returnObject: true,
              signal,
            },
            watsonxCallbacks
          );

        throw new Error(
          "No idOrName or modelId specified. At least one of these needs to be specified in basic mode"
        );
      }
      throw new Error(
        "No service or gateway set. Please check your intsance init"
      );
    };
    const stream = await this.completionWithRetry(callback, options);
    let defaultRole;
    let usage: TextChatUsage | undefined;
    let currentCompletion = 0;
    const counter = { value: -1 };
    for await (const chunk of stream) {
      if (chunk?.data?.usage) usage = chunk.data.usage;
      const { data } = chunk;
      const choice = data.choices[0] as TextChatResultChoice &
        Record<"delta", TextChatResultMessage>;

      if (choice && !("delta" in choice)) {
        continue;
      }
      const delta = choice?.delta;
      if (!delta) {
        continue;
      }

      currentCompletion = choice.index ?? 0;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };

      const generationInfo = {
        ...newTokenIndices,
        finish_reason: choice.finish_reason,
      };

      const message = _convertDeltaToMessageChunk(
        counter,
        delta,
        data,
        this.model,
        chunk.data.usage,
        defaultRole
      );
      defaultRole = (delta.role ||
        defaultRole) as TextChatMessagesTextChatMessageAssistant.Constants.Role;

      if (
        message === null ||
        (!delta.content && !delta.tool_calls && delta.role === "assistant")
      ) {
        continue;
      }
      const generationChunk = new ChatGenerationChunk({
        message,
        text: delta.content ?? "",
        generationInfo,
      });

      yield generationChunk;
      // eslint-disable-next-line no-void
      void _runManager?.handleLLMNewToken(
        generationChunk.text,
        newTokenIndices,
        undefined,
        undefined,
        undefined,
        { chunk: generationChunk }
      );
    }

    const generationChunk = new ChatGenerationChunk({
      message: new AIMessageChunk({
        content: "",
        response_metadata: {
          model: this.model,
          usage,
        },
        usage_metadata: {
          input_tokens: usage?.prompt_tokens ?? 0,
          output_tokens: usage?.completion_tokens ?? 0,
          total_tokens: usage?.total_tokens ?? 0,
        },
      }),
      text: "",
      generationInfo: {
        prompt: options.promptIndex ?? 0,
        completion: currentCompletion ?? 0,
      },
    });
    yield generationChunk;
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
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
  ): Runnable<BaseLanguageModelInput, { raw: BaseMessage; parsed: RunOutput }>;

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
        { raw: BaseMessage; parsed: RunOutput }
      > {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schema: InteropZodType<RunOutput> | Record<string, any> =
      outputSchema;
    const name = config?.name;
    const method = config?.method;
    const includeRaw = config?.includeRaw;
    let functionName = name ?? "extract";
    let outputParser: BaseLLMOutputParser<RunOutput>;
    let llm: Runnable<BaseLanguageModelInput>;
    if (method === "jsonMode") {
      let outputFormatSchema: JsonSchema7Type | undefined;
      if (isInteropZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
        outputFormatSchema = toJsonSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
      const options = {
        responseFormat: { type: "json_object" },
        ls_structured_output_format: {
          kwargs: { method: "jsonMode" },
          schema: outputFormatSchema,
        },
      } as Partial<CallOptions>;
      llm = this.withConfig(options);
    } else {
      if (isInteropZodSchema(schema)) {
        const asJsonSchema = toJsonSchema(schema);
        llm = this.withConfig({
          tools: [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description:
                  asJsonSchema.description ?? `Tool: ${functionName}`,
                parameters: asJsonSchema,
              },
            },
          ],
          // Ideally that would be set to required but this is not supported yet
          tool_choice: {
            type: "function",
            function: {
              name: functionName,
            },
          },
          ls_structured_output_format: {
            kwargs: { method: "functionCalling" },
            schema: asJsonSchema,
          },
        } as Partial<CallOptions>);
        outputParser = new WatsonxToolsOutputParser({
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
        llm = this.withConfig({
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
          ls_structured_output_format: {
            kwargs: { method: "functionCalling" },
            schema: toJsonSchema(schema),
          },
        } as Partial<CallOptions>);
        outputParser = new WatsonxToolsOutputParser<RunOutput>({
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
