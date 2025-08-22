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
import { ChatCompletion } from "@baiducloud/qianfan";

/**
 * Type representing the role of a message in the Qianfan chat model.
 */
export type QianfanRole = "assistant" | "user";

/**
 * Interface representing a message in the Qianfan chat model.
 */
interface Qianfan {
  role: QianfanRole;
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
  messages: Qianfan[];
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
  sentence_id: number;
  is_end: boolean;
  is_truncated: boolean;
  result: string;
  need_clear_history: boolean;
  finish_reason: string;
  usage: TokenUsage;
}

/**
 * Interface defining the input to the ChatBaiduQianfan class.
 */
declare interface BaiduQianfanChatInput {
  /**
   * Model name to use. Available options are: ERNIE-Bot, ERNIE-Lite-8K, ERNIE-Bot-4
   * @default "ERNIE-Bot-turbo"
   */
  model?: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  prefixMessages?: Qianfan[];

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

  return message.role as QianfanRole;
}

/**
 * Function that converts a base message to a Qianfan message role.
 * @param message Base message to convert.
 * @returns The Qianfan message role.
 */
function messageToQianfanRole(message: BaseMessage): QianfanRole {
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
  implements BaiduQianfanChatInput
{
  static lc_name() {
    return "ChatBaiduQianfan";
  }

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      qianfanAK: "QIANFAN_AK",
      qianfanSK: "QIANFAN_SK",
      qianfanAccessKey: "QIANFAN_ACCESS_KEY",
      qianfanSecretKey: "QIANFAN_SECRET_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  streaming = false;

  prefixMessages?: Qianfan[];

  userId?: string;

  model = "ERNIE-Bot-turbo";

  temperature?: number | undefined;

  topP?: number | undefined;

  penaltyScore?: number | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;

  qianfanAK?: string;

  qianfanSK?: string;

  qianfanAccessKey?: string;

  qianfanSecretKey?: string;

  constructor(fields?: Partial<BaiduQianfanChatInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;

    if (!this.model) {
      throw new Error(`Please provide a "model" parameter`);
    }

    this.qianfanAK = fields?.qianfanAK ?? getEnvironmentVariable("QIANFAN_AK");

    this.qianfanSK = fields?.qianfanSK ?? getEnvironmentVariable("QIANFAN_SK");

    this.qianfanAccessKey =
      fields?.qianfanAccessKey ?? getEnvironmentVariable("QIANFAN_ACCESS_KEY");

    this.qianfanSecretKey =
      fields?.qianfanSecretKey ?? getEnvironmentVariable("QIANFAN_SECRET_KEY");

    // 优先使用安全认证AK/SK鉴权
    if (this.qianfanAccessKey && this.qianfanSecretKey) {
      this.client = new ChatCompletion({
        QIANFAN_ACCESS_KEY: this.qianfanAccessKey,
        QIANFAN_SECRET_KEY: this.qianfanSecretKey,
      });
    } else if (this.qianfanAK && this.qianfanSK) {
      this.client = new ChatCompletion({
        QIANFAN_AK: this.qianfanAK,
        QIANFAN_SK: this.qianfanSK,
      });
    } else {
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

  private _ensureMessages(messages: BaseMessage[]): Qianfan[] {
    return messages.map((message) => ({
      role: messageToQianfanRole(message),
      content: message.content.toString(),
    }));
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      let finalChunk: ChatGenerationChunk | undefined;
      const stream = this._streamResponseChunks(messages, options, runManager);
      for await (const chunk of stream) {
        if (finalChunk === undefined) {
          finalChunk = chunk;
        } else {
          finalChunk = finalChunk.concat(chunk);
        }
      }

      if (finalChunk === undefined) {
        throw new Error("No chunks returned from BaiduQianFan API.");
      }

      return {
        generations: [
          {
            text: finalChunk.text,
            message: finalChunk.message,
          },
        ],
        llmOutput: finalChunk.generationInfo?.usage ?? {},
      };
    } else {
      const params = this.invocationParams();

      const systemMessage = messages.find(
        (message) => message._getType() === "system"
      );
      if (systemMessage) {
        // eslint-disable-next-line no-param-reassign
        messages = messages.filter((message) => message !== systemMessage);
        params.system = systemMessage.content.toString();
      }
      const messagesMapped = this._ensureMessages(messages);

      const data = (await this.completionWithRetry(
        {
          ...params,
          messages: messagesMapped,
        },
        false
      )) as ChatCompletionResponse;

      const tokenUsage = data.usage || {};

      const generations: ChatGeneration[] = [
        {
          text: data.result || "",
          message: new AIMessage(data.result || ""),
        },
      ];

      return {
        generations,
        llmOutput: { tokenUsage },
      };
    }
  }

  /** @ignore */
  async completionWithRetry(
    request: ChatCompletionRequest,
    stream: boolean
  ): Promise<
    ChatCompletionResponse | AsyncIterableIterator<ChatCompletionResponse>
  > {
    const makeCompletionRequest = async () => {
      const response = await this.client.chat(request, this.model);
      if (!stream) {
        return response;
      } else {
        return response as AsyncIterableIterator<ChatCompletionResponse>;
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    _options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const parameters = {
      ...this.invocationParams(),
      stream: true,
    };

    const systemMessage = messages.find(
      (message) => message._getType() === "system"
    );
    if (systemMessage) {
      // eslint-disable-next-line no-param-reassign
      messages = messages.filter((message) => message !== systemMessage);
      parameters.system = systemMessage.content.toString();
    }
    const messagesMapped = this._ensureMessages(messages);

    const stream = (await this.caller.call(async () =>
      this.completionWithRetry(
        {
          ...parameters,
          messages: messagesMapped,
        },
        true
      )
    )) as AsyncIterableIterator<ChatCompletionResponse>;

    for await (const chunk of stream) {
      const { result, is_end, id } = chunk;
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
}
