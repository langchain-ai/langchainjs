import {
  Configuration,
  OpenAIApi,
  CreateChatCompletionRequest,
  ConfigurationParameters,
  CreateChatCompletionResponse,
  ChatCompletionResponseMessageRoleEnum,
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  ChatCompletionFunctions,
  CreateChatCompletionRequestFunctionCall,
  ChatCompletionRequestMessageFunctionCall,
} from "openai";
import { getEnvironmentVariable, isNode } from "../util/env.js";
import {
  AzureOpenAIInput,
  OpenAICallOptions,
  OpenAIChatInput,
} from "../types/openai-types.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import type { StreamingAxiosConfiguration } from "../util/axios-types.js";
import { BaseChatModel, BaseChatModelParams } from "./base.js";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatGeneration,
  ChatGenerationChunk,
  ChatMessage,
  ChatMessageChunk,
  ChatResult,
  FunctionMessageChunk,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  SystemMessageChunk,
} from "../schema/index.js";
import { getModelNameForTiktoken } from "../base_language/count_tokens.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";
import { StructuredTool } from "../tools/base.js";
import { formatToOpenAIFunction } from "../tools/convert_to_openai.js";
import { getEndpoint, OpenAIEndpointConfig } from "../util/azure.js";
import { readableStreamToAsyncIterable } from "../util/stream.js";

export { OpenAICallOptions, OpenAIChatInput, AzureOpenAIInput };

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

interface OpenAILLMOutput {
  tokenUsage: TokenUsage;
}

function extractGenericMessageCustomRole(message: ChatMessage) {
  if (
    message.role !== "system" &&
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "function"
  ) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as ChatCompletionResponseMessageRoleEnum;
}

function messageToOpenAIRole(
  message: BaseMessage
): ChatCompletionResponseMessageRoleEnum {
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
    case "generic": {
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

function openAIResponseToChatMessage(
  message: ChatCompletionResponseMessage
): BaseMessage {
  switch (message.role) {
    case "user":
      return new HumanMessage(message.content || "");
    case "assistant":
      return new AIMessage(message.content || "", {
        function_call: message.function_call,
      });
    case "system":
      return new SystemMessage(message.content || "");
    default:
      return new ChatMessage(message.content || "", message.role ?? "unknown");
  }
}

function _convertDeltaToMessageChunk(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delta: Record<string, any>,
  defaultRole?: ChatCompletionResponseMessageRoleEnum
) {
  const role = delta.role ?? defaultRole;
  const content = delta.content ?? "";
  let additional_kwargs;
  if (delta.function_call) {
    additional_kwargs = {
      function_call: delta.function_call,
    };
  } else {
    additional_kwargs = {};
  }
  if (role === "user") {
    return new HumanMessageChunk({ content });
  } else if (role === "assistant") {
    return new AIMessageChunk({ content, additional_kwargs });
  } else if (role === "system") {
    return new SystemMessageChunk({ content });
  } else if (role === "function") {
    return new FunctionMessageChunk({
      content,
      additional_kwargs,
      name: delta.name,
    });
  } else {
    return new ChatMessageChunk({ content, role });
  }
}

export interface ChatOpenAICallOptions extends OpenAICallOptions {
  function_call?: CreateChatCompletionRequestFunctionCall;
  functions?: ChatCompletionFunctions[];
  tools?: StructuredTool[];
  promptIndex?: number;
}

/**
 * Wrapper around OpenAI large language models that use the Chat endpoint.
 *
 * To use you should have the `openai` package installed, with the
 * `OPENAI_API_KEY` environment variable set.
 *
 * To use with Azure you should have the `openai` package installed, with the
 * `AZURE_OPENAI_API_KEY`,
 * `AZURE_OPENAI_API_INSTANCE_NAME`,
 * `AZURE_OPENAI_API_DEPLOYMENT_NAME`
 * and `AZURE_OPENAI_API_VERSION` environment variable set.
 * `AZURE_OPENAI_BASE_PATH` is optional and will override `AZURE_OPENAI_API_INSTANCE_NAME` if you need to use a custom endpoint.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://platform.openai.com/docs/api-reference/chat/create |
 * `openai.createChatCompletion`} can be passed through {@link modelKwargs}, even
 * if not explicitly available on this class.
 */
export class ChatOpenAI
  extends BaseChatModel<ChatOpenAICallOptions>
  implements OpenAIChatInput, AzureOpenAIInput
{
  get callKeys(): (keyof ChatOpenAICallOptions)[] {
    return [
      ...(super.callKeys as (keyof ChatOpenAICallOptions)[]),
      "options",
      "function_call",
      "functions",
      "tools",
      "promptIndex",
    ];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
      openAIApiKey: "openai_api_key",
      azureOpenAIApiVersion: "azure_openai_api_version",
      azureOpenAIApiKey: "azure_openai_api_key",
      azureOpenAIApiInstanceName: "azure_openai_api_instance_name",
      azureOpenAIApiDeploymentName: "azure_openai_api_deployment_name",
    };
  }

  temperature = 1;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  logitBias?: Record<string, number>;

  modelName = "gpt-3.5-turbo";

  modelKwargs?: OpenAIChatInput["modelKwargs"];

  stop?: string[];

  user?: string;

  timeout?: number;

  streaming = false;

  maxTokens?: number;

  openAIApiKey?: string;

  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  azureOpenAIBasePath?: string;

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> &
      BaseChatModelParams & {
        configuration?: ConfigurationParameters;
      },
    /** @deprecated */
    configuration?: ConfigurationParameters
  ) {
    super(fields ?? {});

    this.openAIApiKey =
      fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");

    this.azureOpenAIApiKey =
      fields?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");

    if (!this.azureOpenAIApiKey && !this.openAIApiKey) {
      throw new Error("OpenAI or Azure OpenAI API key not found");
    }

    this.azureOpenAIApiInstanceName =
      fields?.azureOpenAIApiInstanceName ??
      getEnvironmentVariable("AZURE_OPENAI_API_INSTANCE_NAME");

    this.azureOpenAIApiDeploymentName =
      fields?.azureOpenAIApiDeploymentName ??
      getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME");

    this.azureOpenAIApiVersion =
      fields?.azureOpenAIApiVersion ??
      getEnvironmentVariable("AZURE_OPENAI_API_VERSION");

    this.azureOpenAIBasePath =
      fields?.azureOpenAIBasePath ??
      getEnvironmentVariable("AZURE_OPENAI_BASE_PATH");

    this.modelName = fields?.modelName ?? this.modelName;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.timeout = fields?.timeout;

    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.maxTokens = fields?.maxTokens;
    this.n = fields?.n ?? this.n;
    this.logitBias = fields?.logitBias;
    this.stop = fields?.stop;
    this.user = fields?.user;

    this.streaming = fields?.streaming ?? false;

    if (this.azureOpenAIApiKey) {
      if (!this.azureOpenAIApiInstanceName && !this.azureOpenAIBasePath) {
        throw new Error("Azure OpenAI API instance name not found");
      }
      if (!this.azureOpenAIApiDeploymentName) {
        throw new Error("Azure OpenAI API deployment name not found");
      }
      if (!this.azureOpenAIApiVersion) {
        throw new Error("Azure OpenAI API version not found");
      }
    }

    this.clientConfig = {
      apiKey: this.openAIApiKey,
      ...configuration,
      ...fields?.configuration,
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<CreateChatCompletionRequest, "messages"> {
    return {
      model: this.modelName,
      temperature: this.temperature,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      max_tokens: this.maxTokens === -1 ? undefined : this.maxTokens,
      n: this.n,
      logit_bias: this.logitBias,
      stop: options?.stop ?? this.stop,
      user: this.user,
      stream: this.streaming,
      functions:
        options?.functions ??
        (options?.tools
          ? options?.tools.map(formatToOpenAIFunction)
          : undefined),
      function_call: options?.function_call,
      ...this.modelKwargs,
    };
  }

  /** @ignore */
  _identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  // TODO(jacoblee): Refactor with _generate(..., {stream: true}) implementation
  // when we integrate OpenAI's new SDK.
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const messagesMapped: ChatCompletionRequestMessage[] = messages.map(
      (message) => ({
        role: messageToOpenAIRole(message),
        content: message.content,
        name: message.name,
        function_call: message.additional_kwargs
          .function_call as ChatCompletionRequestMessageFunctionCall,
      })
    );
    const params = {
      ...this.invocationParams(options),
      messages: messagesMapped,
      stream: true,
    };
    let defaultRole: ChatCompletionResponseMessageRoleEnum = "assistant";
    const streamIterable = this.startStream(params, options);
    for await (const streamedResponse of streamIterable) {
      const data = JSON.parse(streamedResponse) as {
        choices?: Array<{
          index: number;
          finish_reason: string | null;
          delta: {
            role?: string;
            content?: string;
            function_call?: { name: string; arguments: string };
          };
        }>;
      };

      const choice = data.choices?.[0];
      if (!choice) {
        continue;
      }

      const { delta } = choice;
      const chunk = _convertDeltaToMessageChunk(delta, defaultRole);
      defaultRole = (delta.role ??
        defaultRole) as ChatCompletionResponseMessageRoleEnum;
      const generationChunk = new ChatGenerationChunk({
        message: chunk,
        text: chunk.content,
      });
      yield generationChunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(generationChunk.text ?? "");
    }
  }

  startStream(
    request: CreateChatCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    let done = false;
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const iterable = readableStreamToAsyncIterable(stream.readable);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let err: any;
    this.completionWithRetry(request, {
      ...options,
      adapter: fetchAdapter, // default adapter doesn't do streaming
      responseType: "stream",
      onmessage: (event) => {
        if (done) return;
        if (event.data?.trim?.() === "[DONE]") {
          done = true;
          // eslint-disable-next-line no-void
          void writer.close();
        } else {
          const data = JSON.parse(event.data);
          if (data.error) {
            done = true;
            throw data.error;
          }
          // eslint-disable-next-line no-void
          void writer.write(event.data);
        }
      },
    }).catch((error) => {
      if (!done) {
        err = error;
        done = true;
        // eslint-disable-next-line no-void
        void writer.close();
      }
    });
    return {
      async next() {
        const chunk = await iterable.next();
        if (err) {
          throw err;
        }
        return chunk;
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return this._identifyingParams();
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams(options);
    const messagesMapped: ChatCompletionRequestMessage[] = messages.map(
      (message) => ({
        role: messageToOpenAIRole(message),
        content: message.content,
        name: message.name,
        function_call: message.additional_kwargs
          .function_call as ChatCompletionRequestMessageFunctionCall,
      })
    );

    const data = params.stream
      ? await new Promise<CreateChatCompletionResponse>((resolve, reject) => {
          let response: CreateChatCompletionResponse;
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              ...params,
              messages: messagesMapped,
            },
            {
              signal: options?.signal,
              ...options?.options,
              adapter: fetchAdapter, // default adapter doesn't do streaming
              responseType: "stream",
              onmessage: (event) => {
                if (event.data?.trim?.() === "[DONE]") {
                  if (resolved || rejected) {
                    return;
                  }
                  resolved = true;
                  resolve(response);
                } else {
                  const data = JSON.parse(event.data);
                  if (!data.id) return;
                  if (data?.error) {
                    if (rejected) {
                      return;
                    }
                    rejected = true;
                    reject(data.error);
                    return;
                  }

                  const message = data as {
                    id: string;
                    object: string;
                    created: number;
                    model: string;
                    choices?: Array<{
                      index: number;
                      finish_reason: string | null;
                      delta: {
                        role?: string;
                        content?: string;
                        function_call?: { name: string; arguments: string };
                      };
                    }>;
                  };

                  // on the first message set the response properties
                  if (!response) {
                    response = {
                      id: message.id,
                      object: message.object,
                      created: message.created,
                      model: message.model,
                      choices: [],
                    };
                  }

                  // on all messages, update choice
                  for (const part of message.choices ?? []) {
                    if (part != null) {
                      let choice = response.choices.find(
                        (c) => c.index === part.index
                      );

                      if (!choice) {
                        choice = {
                          index: part.index,
                          finish_reason: part.finish_reason ?? undefined,
                        };
                        response.choices[part.index] = choice;
                      }

                      if (!choice.message) {
                        choice.message = {
                          role: part.delta
                            ?.role as ChatCompletionResponseMessageRoleEnum,
                          content: "",
                        };
                      }

                      if (
                        part.delta.function_call &&
                        !choice.message.function_call
                      ) {
                        choice.message.function_call = {
                          name: "",
                          arguments: "",
                        };
                      }

                      choice.message.content += part.delta?.content ?? "";
                      if (choice.message.function_call) {
                        choice.message.function_call.name +=
                          part.delta?.function_call?.name ?? "";
                        choice.message.function_call.arguments +=
                          part.delta?.function_call?.arguments ?? "";
                      }
                      // eslint-disable-next-line no-void
                      void runManager?.handleLLMNewToken(
                        part.delta?.content ?? "",
                        {
                          prompt: options.promptIndex ?? 0,
                          completion: part.index,
                        }
                      );
                      // TODO we don't currently have a callback method for
                      // sending the function call arguments
                    }
                  }
                  // when all messages are finished, resolve
                  if (
                    !resolved &&
                    !rejected &&
                    message.choices?.every((c) => c.finish_reason != null)
                  ) {
                    resolved = true;
                    resolve(response);
                  }
                }
              },
            }
          ).catch((error) => {
            if (!rejected) {
              rejected = true;
              reject(error);
            }
          });
        })
      : await this.completionWithRetry(
          {
            ...params,
            messages: messagesMapped,
          },
          {
            signal: options?.signal,
            ...options?.options,
          }
        );

    const {
      completion_tokens: completionTokens,
      prompt_tokens: promptTokens,
      total_tokens: totalTokens,
    } = data.usage ?? {};

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
    for (const part of data.choices) {
      const text = part.message?.content ?? "";
      generations.push({
        text,
        message: openAIResponseToChatMessage(
          part.message ?? { role: "assistant" }
        ),
      });
    }
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  async getNumTokensFromMessages(messages: BaseMessage[]): Promise<{
    totalCount: number;
    countPerMessage: number[];
  }> {
    let totalCount = 0;
    let tokensPerMessage = 0;
    let tokensPerName = 0;

    // From: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
    if (getModelNameForTiktoken(this.modelName) === "gpt-3.5-turbo") {
      tokensPerMessage = 4;
      tokensPerName = -1;
    } else if (getModelNameForTiktoken(this.modelName).startsWith("gpt-4")) {
      tokensPerMessage = 3;
      tokensPerName = 1;
    }

    const countPerMessage = await Promise.all(
      messages.map(async (message) => {
        const textCount = await this.getNumTokens(message.content);
        const roleCount = await this.getNumTokens(messageToOpenAIRole(message));
        const nameCount =
          message.name !== undefined
            ? tokensPerName + (await this.getNumTokens(message.name))
            : 0;
        const count = textCount + tokensPerMessage + roleCount + nameCount;

        totalCount += count;
        return count;
      })
    );

    totalCount += 3; // every reply is primed with <|start|>assistant<|message|>

    return { totalCount, countPerMessage };
  }

  /** @ignore */
  async completionWithRetry(
    request: CreateChatCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        azureOpenAIApiDeploymentName: this.azureOpenAIApiDeploymentName,
        azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
        azureOpenAIApiKey: this.azureOpenAIApiKey,
        azureOpenAIBasePath: this.azureOpenAIBasePath,
        basePath: this.clientConfig.basePath,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

      const clientConfig = new Configuration({
        ...this.clientConfig,
        basePath: endpoint,
        baseOptions: {
          timeout: this.timeout,
          ...this.clientConfig.baseOptions,
        },
      });

      this.client = new OpenAIApi(clientConfig);
    }

    const axiosOptions = {
      adapter: isNode() ? undefined : fetchAdapter,
      ...this.clientConfig.baseOptions,
      ...options,
    } as StreamingAxiosConfiguration;
    if (this.azureOpenAIApiKey) {
      axiosOptions.headers = {
        "api-key": this.azureOpenAIApiKey,
        ...axiosOptions.headers,
      };
      axiosOptions.params = {
        "api-version": this.azureOpenAIApiVersion,
        ...axiosOptions.params,
      };
    }
    return this.caller
      .call(
        this.client.createChatCompletion.bind(this.client),
        request,
        axiosOptions
      )
      .then((res) => res.data);
  }

  _llmType() {
    return "openai";
  }

  /** @ignore */
  _combineLLMOutput(...llmOutputs: OpenAILLMOutput[]): OpenAILLMOutput {
    return llmOutputs.reduce<{
      [key in keyof OpenAILLMOutput]: Required<OpenAILLMOutput[key]>;
    }>(
      (acc, llmOutput) => {
        if (llmOutput && llmOutput.tokenUsage) {
          acc.tokenUsage.completionTokens +=
            llmOutput.tokenUsage.completionTokens ?? 0;
          acc.tokenUsage.promptTokens += llmOutput.tokenUsage.promptTokens ?? 0;
          acc.tokenUsage.totalTokens += llmOutput.tokenUsage.totalTokens ?? 0;
        }
        return acc;
      },
      {
        tokenUsage: {
          completionTokens: 0,
          promptTokens: 0,
          totalTokens: 0,
        },
      }
    );
  }
}

export class PromptLayerChatOpenAI extends ChatOpenAI {
  promptLayerApiKey?: string;

  plTags?: string[];

  returnPromptLayerId?: boolean;

  constructor(
    fields?: ConstructorParameters<typeof ChatOpenAI>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
      returnPromptLayerId?: boolean;
    }
  ) {
    super(fields);

    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.PROMPTLAYER_API_KEY
        : undefined);
    this.plTags = fields?.plTags ?? [];
    this.returnPromptLayerId = fields?.returnPromptLayerId ?? false;
  }

  async _generate(
    messages: BaseMessage[],
    options?: string[] | ChatOpenAICallOptions,
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const requestStartTime = Date.now();

    let parsedOptions: ChatOpenAICallOptions;
    if (Array.isArray(options)) {
      parsedOptions = { stop: options } as ChatOpenAICallOptions;
    } else if (options?.timeout && !options.signal) {
      parsedOptions = {
        ...options,
        signal: AbortSignal.timeout(options.timeout),
      };
    } else {
      parsedOptions = options ?? {};
    }

    const generatedResponses = await super._generate(
      messages,
      parsedOptions,
      runManager
    );
    const requestEndTime = Date.now();

    const _convertMessageToDict = (message: BaseMessage) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messageDict: Record<string, any>;

      if (message._getType() === "human") {
        messageDict = { role: "user", content: message.content };
      } else if (message._getType() === "ai") {
        messageDict = { role: "assistant", content: message.content };
      } else if (message._getType() === "function") {
        messageDict = { role: "assistant", content: message.content };
      } else if (message._getType() === "system") {
        messageDict = { role: "system", content: message.content };
      } else if (message._getType() === "generic") {
        messageDict = {
          role: (message as ChatMessage).role,
          content: message.content,
        };
      } else {
        throw new Error(`Got unknown type ${message}`);
      }

      return messageDict;
    };

    const _createMessageDicts = (
      messages: BaseMessage[],
      callOptions?: ChatOpenAICallOptions
    ) => {
      const params = {
        ...this.invocationParams(),
        model: this.modelName,
      };

      if (callOptions?.stop) {
        if (Object.keys(params).includes("stop")) {
          throw new Error("`stop` found in both the input and default params.");
        }
      }
      const messageDicts = messages.map((message) =>
        _convertMessageToDict(message)
      );
      return messageDicts;
    };

    for (let i = 0; i < generatedResponses.generations.length; i += 1) {
      const generation = generatedResponses.generations[i];
      const messageDicts = _createMessageDicts(messages, parsedOptions);

      let promptLayerRequestId: string | undefined;
      const parsedResp = [
        {
          content: generation.text,
          role: messageToOpenAIRole(generation.message),
        },
      ];

      const promptLayerRespBody = await promptLayerTrackRequest(
        this.caller,
        "langchain.PromptLayerChatOpenAI",
        messageDicts,
        this._identifyingParams(),
        this.plTags,
        parsedResp,
        requestStartTime,
        requestEndTime,
        this.promptLayerApiKey
      );

      if (this.returnPromptLayerId === true) {
        if (promptLayerRespBody.success === true) {
          promptLayerRequestId = promptLayerRespBody.request_id;
        }

        if (
          !generation.generationInfo ||
          typeof generation.generationInfo !== "object"
        ) {
          generation.generationInfo = {};
        }

        generation.generationInfo.promptLayerRequestId = promptLayerRequestId;
      }
    }

    return generatedResponses;
  }
}
