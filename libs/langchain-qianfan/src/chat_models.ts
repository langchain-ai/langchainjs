import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { convertEventStreamToIterableReadableDataStream } from "@langchain/core/utils/event_source_parse";
import { ChatCompletion } from "@baiducloud/qianfan";

import { isValidModel } from "./utils.js";

/**
 * Type representing the role of a message in the Wenxin chat model.
 */
export type WenxinMessageRole = "assistant" | "user";

/**
 * Interface representing a message in the Wenxin chat model.
 */
interface WenxinMessage {
  role: WenxinMessageRole;
  content: string;
}

/**
 * Interface representing the usage of tokens in a chat completion.
 */
interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

/**
 * Interface representing a request for a chat completion.
 */
interface ChatCompletionRequest {
  messages: WenxinMessage[];
  stream?: boolean;
  user_id?: string;
  temperature?: number;
  top_p?: number;
  penalty_score?: number;
  system?: string;
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  result: string;
  need_clear_history: boolean;
  usage: TokenUsage;
}

/**
 * Interface defining the input to the ChatBaiduQianfan class.
 */
declare interface BaiduWenxinChatInput {
  /**
   * Model name to use. Available options are: ERNIE-Bot, ERNIE-Bot-turbo, ERNIE-Bot-4
   * Alias for `model`
   * @default "ERNIE-Bot-turbo"
   */
  modelName: string;
  /** Model name to use. Available options are: ERNIE-Bot, ERNIE-Bot-turbo, ERNIE-Bot-4
   * @default "ERNIE-Bot-turbo"
   */
  model: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  prefixMessages?: WenxinMessage[];

  /**
   * ID of the end-user who made requests.
   */
  userId?: string;

  /**
   * Access key to use when making requests by Qianfan SDK. Defaults to the value of
   * `QIANFAN_KEY` environment variable.
   */
  qianfanAK?: string;

  /**
   * Secret key to use when making requests by Qianfan SDK. Defaults to the value of
   * `QIANFAN_KEY` environment variable.
   */
  qianfanSK?: string;

  /**
   * Access key to use when making requests by Qianfan SDK with auth. Defaults to the value of
   * `QIANFAN_ACCESS_KEY` environment variable.
   */
  qianfanAccessKey?: string;

  /**
   * Secret key to use when making requests by Qianfan SDK with auth. Defaults to the value of
   * `QIANFAN_SECRET_KEY` environment variable.
   */
  qianfanSecretKey?: string;

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

  /** Penalizes repeated tokens according to frequency. Range
   * from 1.0 to 2.0. Defaults to 1.0.
   */
  penaltyScore?: number;
}

/**
 * Function that extracts the custom role of a generic chat message.
 * @param message Chat message from which to extract the custom role.
 * @returns The custom role of the chat message.
 */
function extractGenericMessageCustomRole(message: ChatMessage) {
  if (message.role !== "assistant" && message.role !== "user") {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as WenxinMessageRole;
}

/**
 * Function that converts a base message to a Wenxin message role.
 * @param message Base message to convert.
 * @returns The Wenxin message role.
 */
function messageToWenxinRole(message: BaseMessage): WenxinMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      throw new Error("System messages should not be here");
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
 * Wrapper around Baidu ERNIE large language models that use the Chat endpoint.
 *
 * To use you should have the `QIANFAN_AK` and `QIANFAN_SK`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments BaiduERNIEInput
 * ```
 */
export class ChatBaiduQianfan
  extends BaseChatModel
  implements BaiduWenxinChatInput
{
  static lc_name() {
    return "ChatBaiduQianfan";
  }

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      baiduApiKey: "BAIDU_API_KEY",
      apiKey: "BAIDU_API_KEY",
      baiduSecretKey: "BAIDU_SECRET_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  baiduApiKey?: string;

  apiKey?: string;

  baiduSecretKey?: string;

  streaming = false;

  prefixMessages?: WenxinMessage[];

  userId?: string;

  modelName = "ERNIE-Bot-turbo";

  model = "ERNIE-Bot-turbo";

  apiUrl: string;

  temperature?: number | undefined;

  topP?: number | undefined;

  penaltyScore?: number | undefined;

  client?: any;

  qianfanAK?: string;

  qianfanSK?: string;

  qianfanAccessKey?: string;

  qianfanSecretKey?: string;

  constructor(fields?: Partial<BaiduWenxinChatInput> & BaseChatModelParams) {
    super(fields ?? {});
    
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;

    if (!isValidModel(this.model)) {
      throw new Error(`Invalid model name: ${this.model}`);
    }

    this.qianfanAK =
      fields?.qianfanAK ??
      getEnvironmentVariable("QIANFAN_AK");

    this.qianfanSK =
      fields?.qianfanSK ??
      getEnvironmentVariable("QIANFAN_SK");

    this.qianfanAccessKey =
      fields?.qianfanAccessKey ??
      getEnvironmentVariable("QIANFAN_ACCESS_KEY");

    this.qianfanSecretKey =
      fields?.qianfanSecretKey ??
        getEnvironmentVariable("QIANFAN_SECRET_KEY");

    // 优先使用安全认证AK/SK鉴权
    if (this.qianfanAccessKey && this.qianfanSecretKey) {
      this.client = new ChatCompletion({
        QIANFAN_ACCESS_KEY: this.qianfanAccessKey,
        QIANFAN_SECRET_KEY: this.qianfanSecretKey
      });
    }
    else if (this.qianfanAK && this.qianfanSK) {
      this.client = new ChatCompletion({
        QIANFAN_AK: this.qianfanAK,
        QIANFAN_SK: this.qianfanSK
      });
    }
    else {
      throw new Error("Please provide AK/SK");
    }

    this.streaming = fields?.streaming ?? this.streaming;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.userId = fields?.userId ?? this.userId;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.penaltyScore = fields?.penaltyScore ?? this.penaltyScore;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, "messages"> {
    return {
      stream: this.streaming,
      user_id: this.userId,
      temperature: this.temperature,
      top_p: this.topP,
      penalty_score: this.penaltyScore,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  private _ensureMessages(messages: BaseMessage[]): WenxinMessage[] {
    return messages.map((message) => ({
      role: messageToWenxinRole(message),
      content: message.text,
    }));
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};

    const params = this.invocationParams();

    // Wenxin requires the system message to be put in the params, not messages array
    const systemMessage = messages.find(
      (message) => message._getType() === "system"
    );
    if (systemMessage) {
      // eslint-disable-next-line no-param-reassign
      messages = messages.filter((message) => message !== systemMessage);
      params.system = systemMessage.text;
    }
    const messagesMapped = this._ensureMessages(messages);

    const data = params.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
        let rejected = false;
        let resolved = false;
          this.completionWithRetry(
            {
              ...params,
              messages: messagesMapped,
            },
            true,
            options?.signal,
            (event) => {
              resolved = true;
              resolve(event.data);
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
          false,
          options?.signal
        ).then((data) => {
          if (data?.error_code) {
            throw new Error(data?.error_msg);
          }
          return data;
        });

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
    const text = data.result ?? "";
    generations.push({
      text,
      message: new AIMessage(text),
    });
    return {
      generations,
      llmOutput: { tokenUsage },
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
      console.log(request)
      const response = await this.client.chat({
        messages: request.messages,
        stream
      }, this.model);

      if (!stream) {
        return response;
      } else {
        let streamResponse = {} as {
          id: string;
          object: string;
          created: number;
          sentence_id?: number;
          result: string;
          need_clear_history: boolean;
          usage: TokenUsage;
        };
        for await (const message of response as AsyncIterableIterator<any>) {
          // 返回结果
          if (!streamResponse) {
            streamResponse = {
              id: message.id,
              object: message.object,
              created: message.created,
              result: message.result,
              need_clear_history: message.need_clear_history,
              usage: message.usage,
            };
          } else {
            streamResponse.result += message.result;
            streamResponse.created = message.created;
            streamResponse.need_clear_history = message.need_clear_history;
            streamResponse.usage = message.usage;
          }
        }
        const event = new MessageEvent("message", {
          data: streamResponse,
        });
        onmessage?.(event);
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  private async createStream(
    request: ChatCompletionRequest
  ) {
    const response = await this.client.chat({
      messages: request.messages,
      stream: true
    }, this.model);

    return convertEventStreamToIterableReadableDataStream(response);
  }

  private _deserialize(json: string) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.warn(`Received a non-JSON parseable chunk: ${json}`);
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const parameters = {
      ...this.invocationParams(),
      stream: true,
    };

    // Wenxin requires the system message to be put in the params, not messages array
    const systemMessage = messages.find(
      (message) => message._getType() === "system"
    );
    if (systemMessage) {
      // eslint-disable-next-line no-param-reassign
      messages = messages.filter((message) => message !== systemMessage);
      parameters.system = systemMessage.text;
    }
    const messagesMapped = this._ensureMessages(messages);


    const stream = await this.caller.call(async () =>
      this.createStream(
        {
          ...parameters,
          messages: messagesMapped,
        }
      )
    );

    for await (const chunk of stream) {
      const deserializedChunk = this._deserialize(chunk);
      const { result, is_end, id } = deserializedChunk;
      yield new ChatGenerationChunk({
        text: result,
        message: new AIMessageChunk({ content: result }),
        generationInfo: is_end
          ? {
              is_end,
              request_id: id,
              usage: chunk.usage,
            }
          : undefined,
      });
      await runManager?.handleLLMNewToken(result);
    }
  }

  _llmType() {
    return "baiduqianfan";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
