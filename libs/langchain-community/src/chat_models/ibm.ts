/* eslint-disable @typescript-eslint/no-explicit-any */

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
  BaseChatModelCallOptions,
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
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
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
import { z } from "zod";
import {
  BaseLLMOutputParser,
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { isZodSchema } from "@langchain/core/utils/types";
import { zodToJsonSchema } from "zod-to-json-schema";
import { NewTokenIndices } from "@langchain/core/callbacks/base";
import {
  Neverify,
  WatsonxAuth,
  WatsonxChatBasicOptions,
  WatsonxDeployedParams,
  WatsonxParams,
} from "../types/ibm.js";
import {
  _convertToolCallIdToMistralCompatible,
  authenticateAndSetInstance,
  WatsonxToolsOutputParser,
} from "../utils/ibm.js";

export interface WatsonxDeltaStream {
  role?: string;
  content?: string;
  tool_calls?: TextChatToolCall[];
  refusal?: string;
}

export interface WatsonxCallParams
  extends Partial<
    Omit<TextChatParams, "modelId" | "toolChoice" | "messages">
  > {}

export interface WatsonxCallDeployedParams extends DeploymentsTextChatParams {}

export interface WatsonxCallOptionsChat
  extends Omit<BaseChatModelCallOptions, "stop">,
    WatsonxCallParams,
    WatsonxChatBasicOptions {
  promptIndex?: number;
  tool_choice?: TextChatParameterTools | string | "auto" | "any";
}

export interface WatsonxCallOptionsDeployedChat
  extends Omit<BaseChatModelCallOptions, "stop">,
    WatsonxCallDeployedParams,
    WatsonxChatBasicOptions {
  promptIndex?: number;
  tool_choice?: TextChatParameterTools | string | "auto" | "any";
}

type ChatWatsonxToolType = BindToolsInput | TextChatParameterTools;

export interface ChatWatsonxInput
  extends BaseChatModelParams,
    WatsonxParams,
    WatsonxCallParams,
    Neverify<Omit<DeploymentsTextChatParams, "signal" | "headers">> {}

export interface ChatWatsonxDeployedInput
  extends BaseChatModelParams,
    WatsonxDeployedParams,
    Neverify<TextChatParams> {}

export type ChatWatsonxConstructor = BaseChatModelParams &
  Partial<WatsonxParams> &
  WatsonxDeployedParams &
  WatsonxCallParams;
function _convertToValidToolId(model: string, tool_call_id: string) {
  if (model.startsWith("mistralai"))
    return _convertToolCallIdToMistralCompatible(tool_call_id);
  else return tool_call_id;
}

function _convertToolToWatsonxTool(
  tools: ChatWatsonxToolType[]
): WatsonXAI.TextChatParameterTools[] {
  return tools.map((tool) => {
    if ("type" in tool) {
      return tool as WatsonXAI.TextChatParameterTools;
    }
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description ?? "Tool: " + tool.name,
        parameters: zodToJsonSchema(tool.schema),
      },
    };
  });
}

function _convertMessagesToWatsonxMessages(
  messages: BaseMessage[],
  model?: string
): TextChatResultMessage[] {
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
        return "function";
      default:
        throw new Error(`Unknown message type: ${role}`);
    }
  };

  const getTools = (message: BaseMessage): TextChatToolCall[] | undefined => {
    if (isAIMessage(message) && message.tool_calls?.length) {
      return message.tool_calls
        .map((toolCall) => ({
          ...toolCall,
          id: _convertToValidToolId(model ?? "", toolCall.id ?? ""),
        }))
        .map(convertLangChainToolCallToOpenAI) as TextChatToolCall[];
    }
    return undefined;
  };

  return messages.map((message) => {
    const toolCalls = getTools(message);
    const content = toolCalls === undefined ? message.content : "";
    if ("tool_call_id" in message && typeof message.tool_call_id === "string") {
      return {
        role: getRole(message._getType()),
        content,
        name: message.name,
        tool_call_id: _convertToValidToolId(model ?? "", message.tool_call_id),
      };
    }

    return {
      role: getRole(message._getType()),
      content,
      tool_calls: toolCalls,
    };
  }) as TextChatResultMessage[];
}

function _watsonxResponseToChatMessage(
  choice: TextChatResultChoice,
  rawDataId: string,
  usage?: TextChatUsage
): BaseMessage {
  const { message } = choice;
  if (!message) throw new Error("No message presented");
  const rawToolCalls: TextChatToolCall[] = message.tool_calls ?? [];

  switch (message.role) {
    case "assistant": {
      const toolCalls = [];
      const invalidToolCalls = [];
      for (const rawToolCall of rawToolCalls) {
        try {
          const parsed = parseToolCall(rawToolCall, { returnId: true });
          toolCalls.push(parsed);
        } catch (e: any) {
          invalidToolCalls.push(makeInvalidToolCall(rawToolCall, e.message));
        }
      }
      const additional_kwargs: Record<string, unknown> = {
        tool_calls: rawToolCalls.map((toolCall) => ({
          ...toolCall,
          type: "function",
        })),
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
  delta: WatsonxDeltaStream,
  rawData: TextChatResponse,
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
        ): TextChatToolCall & {
          index: number;
          type: "function";
        } => ({
          index,
          ...toolCall,
          id: _convertToValidToolId(model ?? "", toolCall.id),
          type: "function",
        })
      )
    : undefined;

  let role = "assistant";
  if (delta.role) {
    role = delta.role;
  } else if (defaultRole) {
    role = defaultRole;
  }
  const content = delta.content ?? "";
  let additional_kwargs;
  if (rawToolCalls) {
    additional_kwargs = {
      tool_calls: rawToolCalls,
    };
  } else {
    additional_kwargs = {};
  }

  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    const toolCallChunks: ToolCallChunk[] = [];
    if (rawToolCalls && rawToolCalls.length > 0)
      for (const rawToolCallChunk of rawToolCalls) {
        toolCallChunks.push({
          name: rawToolCallChunk.function?.name,
          args: rawToolCallChunk.function?.arguments,
          id: rawToolCallChunk.id,
          index: rawToolCallChunk.index,
          type: "tool_call_chunk",
        });
      }

    return new AIMessageChunk({
      content,
      tool_call_chunks: toolCallChunks,
      additional_kwargs,
      usage_metadata: {
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
      },
      id: rawData.id,
    });
  } else if (role === "tool") {
    if (rawToolCalls)
      return new ToolMessageChunk({
        content,
        additional_kwargs,
        tool_call_id: _convertToValidToolId(model ?? "", rawToolCalls?.[0].id),
      });
  } else if (role === "function") {
    return new FunctionMessageChunk({
      content,
      additional_kwargs,
    });
  } else {
    return new ChatMessageChunk({ content, role });
  }
  return null;
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

export class ChatWatsonx<
    CallOptions extends WatsonxCallOptionsChat =
      | WatsonxCallOptionsChat
      | WatsonxCallOptionsDeployedChat
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

  model?: string;

  version = "2024-05-31";

  maxTokens: number;

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

  maxConcurrency?: number;

  service: WatsonXAI;

  responseFormat?: TextChatResponseFormat;

  streaming: boolean;

  watsonxCallbacks?: RequestCallbacks;

  constructor(
    fields: (ChatWatsonxInput | ChatWatsonxDeployedInput) & WatsonxAuth
  ) {
    super(fields);
    if (
      ("projectId" in fields && "spaceId" in fields) ||
      ("projectId" in fields && "idOrName" in fields) ||
      ("spaceId" in fields && "idOrName" in fields)
    )
      throw new Error("Maximum 1 id type can be specified per instance");

    if ("model" in fields) {
      this.projectId = fields?.projectId;
      this.spaceId = fields?.spaceId;
      this.temperature = fields?.temperature;
      this.maxRetries = fields?.maxRetries || this.maxRetries;
      this.maxConcurrency = fields?.maxConcurrency;
      this.frequencyPenalty = fields?.frequencyPenalty;
      this.topLogprobs = fields?.topLogprobs;
      this.maxTokens = fields?.maxTokens ?? this.maxTokens;
      this.presencePenalty = fields?.presencePenalty;
      this.topP = fields?.topP;
      this.timeLimit = fields?.timeLimit;
      this.responseFormat = fields?.responseFormat ?? this.responseFormat;
      this.streaming = fields?.streaming ?? this.streaming;
      this.n = fields?.n ?? this.n;
      this.model = fields?.model ?? this.model;
    } else this.idOrName = fields?.idOrName;

    this.watsonxCallbacks = fields?.watsonxCallbacks ?? this.watsonxCallbacks;
    this.serviceUrl = fields?.serviceUrl;
    this.version = fields?.version ?? this.version;

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

    const auth = authenticateAndSetInstance({
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    });
    if (auth) this.service = auth;
    else throw new Error("You have not provided one type of authentication");
  }

  _llmType() {
    return "watsonx";
  }

  invocationParams(options: this["ParsedCallOptions"]) {
    const { signal, promptIndex, ...rest } = options;
    if (this.idOrName && Object.keys(rest).length > 0)
      throw new Error("Options cannot be provided to a deployed model");

    const params = {
      maxTokens: options.maxTokens ?? this.maxTokens,
      temperature: options?.temperature ?? this.temperature,
      timeLimit: options?.timeLimit ?? this.timeLimit,
      topP: options?.topP ?? this.topP,
      presencePenalty: options?.presencePenalty ?? this.presencePenalty,
      n: options?.n ?? this.n,
      topLogprobs: options?.topLogprobs ?? this.topLogprobs,
      logprobs: options?.logprobs ?? this?.logprobs,
      frequencyPenalty: options?.frequencyPenalty ?? this.frequencyPenalty,
      tools: options.tools
        ? _convertToolToWatsonxTool(options.tools)
        : undefined,
      responseFormat: options.responseFormat,
    };
    const toolChoiceResult = options.tool_choice
      ? _convertToolChoiceToWatsonxToolChoice(options.tool_choice)
      : {};
    return { ...params, ...toolChoiceResult };
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

  scopeId():
    | { idOrName: string }
    | { projectId: string; modelId: string }
    | { spaceId: string; modelId: string }
    | { modelId: string } {
    if (this.projectId && this.model)
      return { projectId: this.projectId, modelId: this.model };
    else if (this.spaceId && this.model)
      return { spaceId: this.spaceId, modelId: this.model };
    else if (this.idOrName) return { idOrName: this.idOrName };
    else if (this.model)
      return {
        modelId: this.model,
      };
    else throw new Error("No id or model provided!");
  }

  async completionWithRetry<T>(
    callback: () => T,
    options?: this["ParsedCallOptions"]
  ) {
    const caller = new AsyncCaller({
      maxConcurrency: options?.maxConcurrency || this.maxConcurrency,
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
        if (message?.usage_metadata) {
          const completion = chunk.generationInfo?.completion;
          if (tokenUsages[completion])
            tokenUsages[completion].output_tokens =
              message.usage_metadata.output_tokens;
          else tokenUsages[completion] = message.usage_metadata;
        }
        chunk.message.response_metadata = {
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
      const scopeId = this.scopeId();
      const watsonxCallbacks = this.invocationCallbacks(options);
      const watsonxMessages = _convertMessagesToWatsonxMessages(
        messages,
        this.model
      );
      const callback = () =>
        "idOrName" in scopeId
          ? this.service.deploymentsTextChat(
              {
                ...scopeId,
                messages: watsonxMessages,
              },
              watsonxCallbacks
            )
          : this.service.textChat(
              {
                ...params,
                ...scopeId,
                messages: watsonxMessages,
              },
              watsonxCallbacks
            );
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
      if (options.signal?.aborted) {
        throw new Error("AbortError");
      }

      return {
        generations,
        llmOutput: {
          tokenUsage: result?.usage,
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
    const scopeId = this.scopeId();
    const watsonxMessages = _convertMessagesToWatsonxMessages(
      messages,
      this.model
    );
    const watsonxCallbacks = this.invocationCallbacks(options);
    const callback = () =>
      "idOrName" in scopeId
        ? this.service.deploymentsTextChatStream(
            {
              ...scopeId,
              messages: watsonxMessages,
              returnObject: true,
            },
            watsonxCallbacks
          )
        : this.service.textChatStream(
            {
              ...params,
              ...scopeId,
              messages: watsonxMessages,
              returnObject: true,
            },
            watsonxCallbacks
          );

    const stream = await this.completionWithRetry(callback, options);
    let defaultRole;
    let usage: TextChatUsage | undefined;
    let currentCompletion = 0;
    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        throw new Error("AbortError");
      }
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
        delta,
        data,
        this.model,
        chunk.data.usage,
        defaultRole
      );

      defaultRole =
        (delta.role as TextChatMessagesTextChatMessageAssistant.Constants.Role) ??
        defaultRole;

      if (message === null || (!delta.content && !delta.tool_calls)) {
        continue;
      }
      const generationChunk = new ChatGenerationChunk({
        message,
        text: delta.content ?? "",
        generationInfo,
      });

      yield generationChunk;

      void _runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
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
      const options = {
        responseFormat: { type: "json_object" },
      } as Partial<CallOptions>;
      llm = this.withConfig(options);

      if (isZodSchema(schema)) {
        outputParser = StructuredOutputParser.fromZodSchema(schema);
      } else {
        outputParser = new JsonOutputParser<RunOutput>();
      }
    } else {
      if (isZodSchema(schema)) {
        const asJsonSchema = zodToJsonSchema(schema);
        llm = this.bindTools(
          [
            {
              type: "function" as const,
              function: {
                name: functionName,
                description: asJsonSchema.description,
                parameters: asJsonSchema,
              },
            },
          ],
          {
            // Ideally that would be set to required but this is not supported yet
            tool_choice: {
              type: "function",
              function: {
                name: functionName,
              },
            },
          } as Partial<CallOptions>
        );
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
        llm = this.bindTools(
          [
            {
              type: "function" as const,
              function: openAIFunctionDefinition,
            },
          ],
          {
            // Ideally that would be set to required but this is not supported yet
            tool_choice: {
              type: "function",
              function: {
                name: functionName,
              },
            },
          } as Partial<CallOptions>
        );
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
