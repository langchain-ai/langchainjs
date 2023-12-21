import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessage, BaseMessage, ChatMessage } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  BaseWebSocketStream,
  WebSocketStreamOptions,
} from "../../utils/iflytek_websocket_stream.js";

/**
 * Type representing the role of a message in the Xinghuo chat model.
 */
export type XinghuoMessageRole = "assistant" | "user";

/**
 * Interface representing a message in the Xinghuo chat model.
 */
interface XinghuoMessage {
  role: XinghuoMessageRole;
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
  messages: XinghuoMessage[];
  temperature?: number;
  max_tokens?: number;
  top_k?: number;
  chat_id?: string;
}

export interface ChatCompletionChunk {
  header: {
    code: number;
    message: string;
    sid: string;
    status: number;
  };
  payload: {
    choices: {
      status: number;
      seq: number;
      text: {
        content: string;
        role: XinghuoMessageRole;
        index: number;
      }[];
    };
    usage?: {
      text: {
        question_tokens: number;
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };
  };
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse {
  result: string;
  usage?: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
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
  return message.role as XinghuoMessageRole;
}

/**
 * Function that converts a base message to a Xinghuo message role.
 * @param message Base message to convert.
 * @returns The Xinghuo message role.
 */
function messageToXinghuoRole(message: BaseMessage): XinghuoMessageRole {
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

declare interface IflytekXinghuoChatInput {
  /** Model version to use. Available options are: v1.1, v2.1, v3.1
   * @default "v2.1"
   */
  version: string;

  /**
   * ID of the end-user who made requests.
   */
  userId?: string;

  /**
   * APPID to use when making requests. Defaults to the value of
   * `IFLYTEK_APPID` environment variable.
   */
  iflytekAppid?: string;

  /**
   * API key to use when making requests. Defaults to the value of
   * `IFLYTEK_API_KEY` environment variable.
   */
  iflytekApiKey?: string;

  /**
   * API Secret to use when making requests. Defaults to the value of
   * `IFLYTEK_API_SECRET` environment variable.
   */
  iflytekApiSecret?: string;

  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks. Defaults to 0.5.
   */
  temperature?: number;

  max_tokens?: number;

  top_k?: number;

  streaming?: boolean;
}

/**
 * Wrapper around IflytekXingHuo large language models that use the Chat endpoint.
 *
 * To use you should have the `IFLYTEK_API_KEY` and `IFLYTEK_API_SECRET` and `IFLYTEK_APPID`
 * environment variable set.
 *
 * @augments BaseChatModel
 * @augments IflytekXinghuoChatInput
 */
export abstract class BaseChatIflytekXinghuo
  extends BaseChatModel
  implements IflytekXinghuoChatInput
{
  static lc_name() {
    return "ChatIflytekXinghuo";
  }

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      iflytekApiKey: "IFLYTEK_API_KEY",
      iflytekApiSecret: "IFLYTEK_API_SECRET",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  version = "v2.1";

  iflytekAppid: string;

  iflytekApiKey: string;

  iflytekApiSecret: string;

  userId?: string;

  apiUrl: string;

  domain: string;

  temperature = 0.5;

  max_tokens = 2048;

  top_k = 4;

  streaming = false;

  constructor(fields?: Partial<IflytekXinghuoChatInput> & BaseChatModelParams) {
    super(fields ?? {});

    const iflytekAppid =
      fields?.iflytekAppid ?? getEnvironmentVariable("IFLYTEK_APPID");
    if (!iflytekAppid) {
      throw new Error("Iflytek APPID not found");
    } else {
      this.iflytekAppid = iflytekAppid;
    }

    const iflytekApiKey =
      fields?.iflytekApiKey ?? getEnvironmentVariable("IFLYTEK_API_KEY");
    if (!iflytekApiKey) {
      throw new Error("Iflytek API key not found");
    } else {
      this.iflytekApiKey = iflytekApiKey;
    }

    const iflytekApiSecret =
      fields?.iflytekApiSecret ?? getEnvironmentVariable("IFLYTEK_API_SECRET");
    if (!iflytekApiSecret) {
      throw new Error("Iflytek API secret not found");
    } else {
      this.iflytekApiSecret = iflytekApiSecret;
    }

    this.userId = fields?.userId ?? this.userId;
    this.streaming = fields?.streaming ?? this.streaming;
    this.temperature = fields?.temperature ?? this.temperature;
    this.max_tokens = fields?.max_tokens ?? this.max_tokens;
    this.top_k = fields?.top_k ?? this.top_k;

    this.version = fields?.version ?? this.version;
    if (["v1.1", "v2.1", "v3.1"].includes(this.version)) {
      switch (this.version) {
        case "v1.1":
          this.domain = "general";
          break;
        case "v2.1":
          this.domain = "generalv2";
          break;
        case "v3.1":
          this.domain = "generalv3";
          break;
        default:
          this.domain = "generalv2";
      }
      this.apiUrl = `wss://spark-api.xf-yun.com/${this.version}/chat`;
    } else {
      throw new Error(`Invalid model version: ${this.version}`);
    }
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      version: this.version,
      ...this.invocationParams(),
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, "messages"> & {
    streaming: boolean;
  } {
    return {
      streaming: this.streaming,
      temperature: this.temperature,
      top_k: this.top_k,
    };
  }

  /**
   * Method that retrieves the auth websocketStream for making requests to the Iflytek Xinghuo API.
   * @returns The auth websocketStream for making requests to the Iflytek Xinghuo API.
   */
  abstract openWebSocketStream<T extends BaseWebSocketStream<string>>(
    options: WebSocketStreamOptions
  ): Promise<T>;

  /**
   * Calls the Xinghuo API completion.
   * @param request The request to send to the Xinghuo API.
   * @param signal The signal for the API call.
   * @returns The response from the Xinghuo API.
   */
  async completion(
    request: ChatCompletionRequest,
    stream: true,
    signal?: AbortSignal
  ): Promise<IterableReadableStream<string>>;

  async completion(
    request: ChatCompletionRequest,
    stream: false,
    signal?: AbortSignal
  ): Promise<ChatCompletionResponse>;

  async completion(
    request: ChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal
  ): Promise<IterableReadableStream<string> | ChatCompletionResponse> {
    const webSocketStream = await this.openWebSocketStream({
      signal,
    });
    const connection = await webSocketStream.connection;
    const header = {
      app_id: this.iflytekAppid,
      uid: this.userId,
    };
    const parameter = {
      chat: {
        domain: this.domain,
        temperature: request.temperature ?? this.temperature,
        max_tokens: request.max_tokens ?? this.max_tokens,
        top_k: request.top_k ?? this.top_k,
      },
    };
    const payload = {
      message: {
        text: request.messages,
      },
    };
    const message = JSON.stringify({
      header,
      parameter,
      payload,
    });
    const { writable, readable } = connection;
    const writer = writable.getWriter();
    await writer.write(message);
    const streams = IterableReadableStream.fromReadableStream(readable);
    if (stream) {
      return streams;
    } else {
      let response: ChatCompletionResponse = { result: "" };
      for await (const chunk of streams) {
        const data = JSON.parse(chunk) as ChatCompletionChunk;
        const { header, payload } = data;
        if (header.code === 0) {
          if (header.status === 0) {
            response.result = payload.choices?.text[0]?.content ?? "";
          } else if (header.status === 1) {
            response.result += payload.choices?.text[0]?.content ?? "";
          } else if (header.status === 2) {
            response = { ...response, usage: payload.usage?.text };
            break;
          }
        } else {
          break;
        }
      }
      void streams.cancel();
      void webSocketStream.close();
      return response;
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};
    const params = this.invocationParams();
    const messagesMapped: XinghuoMessage[] = messages.map((message) => {
      if (typeof message.content !== "string") {
        throw new Error(
          "ChatIflytekXinghuo does not support non-string message content."
        );
      }
      return {
        role: messageToXinghuoRole(message),
        content: message.content,
      };
    });
    const data = params.streaming
      ? await (async () => {
          const streams = await this.completion(
            { messages: messagesMapped, ...params },
            true,
            options.signal
          );
          let response: ChatCompletionResponse = { result: "" };
          for await (const chunk of streams) {
            const data = JSON.parse(chunk) as ChatCompletionChunk;
            const { header, payload } = data;
            if (header.code === 0) {
              if (header.status === 0) {
                response.result = payload.choices?.text[0]?.content ?? "";
              } else if (header.status === 1) {
                response.result += payload.choices?.text[0]?.content ?? "";
              } else if (header.status === 2) {
                response = { ...response, usage: payload.usage?.text };
                break;
              }
              void runManager?.handleLLMNewToken(
                payload.choices?.text[0]?.content
              );
            } else {
              break;
            }
          }
          void streams.cancel();
          return response;
        })()
      : await this.completion(
          { messages: messagesMapped, ...params },
          false,
          options.signal
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _combineLLMOutput(): Record<string, any> | undefined {
    return [];
  }

  _llmType(): string {
    return "iflytek_xinghuo";
  }
}
