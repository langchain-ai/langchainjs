import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatResult,
  ChatGenerationChunk,
} from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { IterableReadableStream } from "@langchain/core/utils/stream";
import { sign } from "../../utils/tencent_hunyuan/common.js";

/**
 * Type representing the role of a message in the Hunyuan chat model.
 */
export type HunyuanMessageRole = "system" | "assistant" | "user";

/**
 * Interface representing a message in the Hunyuan chat model.
 */
interface HunyuanMessage {
  Role: HunyuanMessageRole;
  Content: string;
}

/**
 * Models available, see https://cloud.tencent.com/document/product/1729/104753.
 */
type ModelName =
  | (string & NonNullable<unknown>)
  // hunyuan-lite
  | "hunyuan-lite" // context size: 4k, input size: 3k, output size: 1k
  // hunyuan-standard
  | "hunyuan-standard" // alias for hunyuan-standard-32K
  | "hunyuan-standard-32K" // context size: 32k, input size: 30k, output size: 2k
  | "hunyuan-standard-256K" // context size: 256k, input size: 250k, output size: 6k
  // hunyuan-pro
  | "hunyuan-pro"; // context size: 32k, input size: 28k, output size: 4k

/**
 * Interface representing the usage of tokens in a chat completion.
 * See https://cloud.tencent.com/document/api/1729/101838#Usage.
 */
interface Usage {
  TotalTokens?: number;
  PromptTokens?: number;
  CompletionTokens?: number;
}

/**
 * Interface representing a request for a chat completion.
 * See https://cloud.tencent.com/document/api/1729/105701.
 */
interface ChatCompletionRequest {
  Model: ModelName;
  Messages: HunyuanMessage[];
  Stream?: boolean;
  StreamModeration?: boolean;
  EnableEnhancement?: boolean;
  Temperature?: number;
  TopP?: number;
}

/**
 * Interface representing a chat completion choice message.
 * See https://cloud.tencent.com/document/api/1729/101838#Message.
 */
interface ChoiceMessage {
  Role: string;
  Content: string;
}

/**
 * Interface representing a chat completion choice.
 * See https://cloud.tencent.com/document/api/1729/101838#Choice.
 */
interface Choice {
  FinishReason: "stop" | "sensitive" | "";
  Delta: ChoiceMessage;
  Message: ChoiceMessage;
}

/**
 * Interface representing a error response from a chat completion.
 */
interface Error {
  Code: string;
  Message: string;
}

/**
 * Interface representing a response from a chat completion.
 * See https://cloud.tencent.com/document/product/1729/105701.
 */
interface ChatCompletionResponse {
  Created: number;
  Usage: Usage;
  Note: string;
  Choices: Choice[];
  Id?: string;
  RequestId?: string;
  Error?: Error;
  ErrorMsg?: Error;
}

/**
 * Interface defining the input to the ChatTencentHunyuan class.
 */
export interface TencentHunyuanChatInput {
  /**
   * Tencent Cloud API Host.
   * @default "hunyuan.tencentcloudapi.com"
   */
  host?: string;

  /**
   * Model name to use.
   * @default "hunyuan-pro"
   */
  model: ModelName;

  /**
   * Whether to stream the results or not. Defaults to false.
   * @default false
   */
  streaming?: boolean;

  /**
   * SecretID to use when making requests, can be obtained from https://console.cloud.tencent.com/cam/capi.
   * Defaults to the value of `TENCENT_SECRET_ID` environment variable.
   */
  tencentSecretId?: string;

  /**
   * Secret key to use when making requests, can be obtained from https://console.cloud.tencent.com/cam/capi.
   * Defaults to the value of `TENCENT_SECRET_KEY` environment variable.
   */
  tencentSecretKey?: string;

  /**
   * Amount of randomness injected into the response. Ranges
   * from 0.0 to 2.0. Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks. Defaults to 1.0.95.
   */
  temperature?: number;

  /**
   * Total probability mass of tokens to consider at each step. Range
   * from 0 to 1.0. Defaults to 1.0.
   */
  topP?: number;
}

/**
 * Interface defining the input to the ChatTencentHunyuan class.
 */
interface TencentHunyuanChatInputWithSign extends TencentHunyuanChatInput {
  /**
   * Tencent Cloud API v3 sign method.
   */
  sign: sign;
}

/**
 * Function that converts a base message to a Hunyuan message role.
 * @param message Base message to convert.
 * @returns The Hunyuan message role.
 */
function messageToRole(message: BaseMessage): HunyuanMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    case "function":
      throw new Error("Function messages not supported");
    case "generic": {
      if (!ChatMessage.isInstance(message)) {
        throw new Error("Invalid generic chat message");
      }
      if (["system", "assistant", "user"].includes(message.role)) {
        return message.role as HunyuanMessageRole;
      }
      throw new Error(`Unknown message role: ${message.role}`);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Wrapper around Tencent Hunyuan large language models that use the Chat endpoint.
 *
 * To use you should have the `TENCENT_SECRET_ID` and `TENCENT_SECRET_KEY`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments TencentHunyuanInput
 * @example
 * ```typescript
 * const messages = [new HumanMessage("Hello")];
 *
 * const hunyuanLite = new ChatTencentHunyuan({
 *   model: "hunyuan-lite",
 *   tencentSecretId: "YOUR-SECRET-ID",
 *   tencentSecretKey: "YOUR-SECRET-KEY",
 * });
 *
 * let res = await hunyuanLite.call(messages);
 *
 * const hunyuanPro = new ChatTencentHunyuan({
 *   model: "hunyuan-pro",
 *   temperature: 1,
 *   tencentSecretId: "YOUR-SECRET-ID",
 *   tencentSecretKey: "YOUR-SECRET-KEY",
 * });
 *
 * res = await hunyuanPro.call(messages);
 * ```
 */
export class ChatTencentHunyuan
  extends BaseChatModel
  implements TencentHunyuanChatInputWithSign
{
  static lc_name() {
    return "ChatTencentHunyuan";
  }

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      tencentSecretId: "TENCENT_SECRET_ID",
      tencentSecretKey: "TENCENT_SECRET_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  tencentSecretId?: string;

  tencentSecretKey?: string;

  streaming = false;

  host = "hunyuan.tencentcloudapi.com";

  model = "hunyuan-pro";

  temperature?: number | undefined;

  topP?: number | undefined;

  sign: sign;

  constructor(
    fields?: Partial<TencentHunyuanChatInputWithSign> & BaseChatModelParams
  ) {
    super(fields ?? {});

    this.tencentSecretId =
      fields?.tencentSecretId ?? getEnvironmentVariable("TENCENT_SECRET_ID");
    if (!this.tencentSecretId) {
      throw new Error("Tencent SecretID not found");
    }

    this.tencentSecretKey =
      fields?.tencentSecretKey ?? getEnvironmentVariable("TENCENT_SECRET_KEY");
    if (!this.tencentSecretKey) {
      throw new Error("Tencent SecretKey not found");
    }

    this.host = fields?.host ?? this.host;
    this.topP = fields?.topP ?? this.topP;
    this.model = fields?.model ?? this.model;
    this.streaming = fields?.streaming ?? this.streaming;
    this.temperature = fields?.temperature ?? this.temperature;
    if (!fields?.sign) {
      throw new Error("Sign method undefined");
    }
    this.sign = fields?.sign;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, "Messages"> {
    return {
      TopP: this.topP,
      Model: this.model,
      Stream: this.streaming,
      Temperature: this.temperature,
    };
  }

  /**
   * Get the HTTP headers used to invoke the model
   */
  invocationHeaders(request: object, timestamp: number): HeadersInit {
    const headers = {
      "Content-Type": "application/json",
      "X-TC-Action": "ChatCompletions",
      "X-TC-Version": "2023-09-01",
      "X-TC-Timestamp": timestamp.toString(),
      Authorization: "",
    };

    headers.Authorization = this.sign(
      this.host,
      request,
      timestamp,
      this.tencentSecretId ?? "",
      this.tencentSecretKey ?? "",
      headers
    );
    return headers;
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const stream = await this.caller.call(async () =>
      this.createStream(
        {
          ...this.invocationParams(),
          Messages: messages.map((message) => ({
            Role: messageToRole(message),
            Content: message.content as string,
          })),
        },
        options?.signal
      )
    );

    for await (const chunk of stream) {
      // handle streaming error
      if (chunk.ErrorMsg?.Message) {
        throw new Error(`[${chunk.Id}] ${chunk.ErrorMsg?.Message}`);
      }

      const {
        Choices: [
          {
            Delta: { Content },
            FinishReason,
          },
        ],
      } = chunk;
      yield new ChatGenerationChunk({
        text: Content,
        message: new AIMessageChunk({ content: Content }),
        generationInfo: FinishReason
          ? {
              usage: chunk.Usage,
              request_id: chunk.Id,
              finish_reason: FinishReason,
            }
          : undefined,
      });
      await runManager?.handleLLMNewToken(Content);
    }
  }

  private async *createStream(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ): AsyncGenerator<ChatCompletionResponse> {
    const timestamp = Math.trunc(Date.now() / 1000);
    const headers = this.invocationHeaders(request, timestamp);
    const response = await fetch(`https://${this.host}`, {
      headers,
      method: "POST",
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Hunyuan call failed with status code ${response.status}: ${text}`
      );
    }

    if (
      !response.headers.get("content-type")?.startsWith("text/event-stream")
    ) {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data?.Response?.Error?.Message) {
          throw new Error(
            `[${data?.Response?.RequestId}] ${data?.Response?.Error?.Message}`
          );
        }
      } catch (e) {
        throw new Error(
          `Could not begin Hunyuan stream, received a non-JSON parseable response: ${text}.`
        );
      }
    }

    if (!response.body) {
      throw new Error(
        `Could not begin Hunyuan stream, received empty body response.`
      );
    }

    const decoder = new TextDecoder("utf-8");
    const stream = IterableReadableStream.fromReadableStream(response.body);
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
        } catch (e) {
          console.warn(`Received a non-JSON parseable chunk: ${line}`);
        }
      }
    }
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const params = this.invocationParams();
    if (params.Stream) {
      let usage: Usage = {};
      const stream = this._streamResponseChunks(
        messages,
        options ?? {},
        runManager
      );

      const generations: ChatGeneration[] = [];
      for await (const chunk of stream) {
        const text = chunk.text ?? "";
        generations.push({
          text,
          message: new AIMessage(text),
        });
        usage = chunk.generationInfo?.usage;
      }
      return {
        generations,
        llmOutput: {
          tokenUsage: {
            totalTokens: usage.TotalTokens,
            promptTokens: usage.PromptTokens,
            completionTokens: usage.CompletionTokens,
          },
        },
      };
    }

    const data = await this.completionWithRetry(
      {
        ...params,
        Messages: messages.map((message) => ({
          Role: messageToRole(message),
          Content: message.content as string,
        })),
      },
      options?.signal
    ).then<ChatCompletionResponse>((data) => {
      const response: ChatCompletionResponse = data?.Response;
      if (response?.Error?.Message) {
        throw new Error(`[${response.RequestId}] ${response.Error.Message}`);
      }
      return response;
    });

    const text = data.Choices[0]?.Message?.Content ?? "";
    const {
      TotalTokens = 0,
      PromptTokens = 0,
      CompletionTokens = 0,
    } = data.Usage;

    return {
      generations: [
        {
          text,
          message: new AIMessage(text),
        },
      ],
      llmOutput: {
        tokenUsage: {
          totalTokens: TotalTokens,
          promptTokens: PromptTokens,
          completionTokens: CompletionTokens,
        },
      },
    };
  }

  /** @ignore */
  async completionWithRetry(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ) {
    return this.caller.call(async () => {
      const timestamp = Math.trunc(Date.now() / 1000);
      const headers = this.invocationHeaders(request, timestamp);
      const response = await fetch(`https://${this.host}`, {
        headers,
        method: "POST",
        body: JSON.stringify(request),
        signal,
      });

      return response.json();
    });
  }

  _llmType() {
    return "tencenthunyuan";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
