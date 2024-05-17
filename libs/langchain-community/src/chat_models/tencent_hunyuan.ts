import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessage, BaseMessage, ChatMessage } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { sign } from "../utils/tencent_hunyuan.js";

const host = "hunyuan.tencentcloudapi.com";

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
 * Interface representing a response from a chat completion.
 * See https://cloud.tencent.com/document/product/1729/105701.
 */
interface ChatCompletionResponse {
  Created: number;
  Usage: Usage;
  Note: string;
  Id: string;
  Choices: Choice[];
  RequestId: string;
}

/**
 * Interface defining the input to the ChatTencentHunyuan class.
 */
declare interface TencentHunyuanChatInput {
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
  implements TencentHunyuanChatInput
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

  model = "hunyuan-pro";

  temperature?: number | undefined;

  topP?: number | undefined;

  constructor(fields?: Partial<TencentHunyuanChatInput> & BaseChatModelParams) {
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

    this.topP = fields?.topP ?? this.topP;
    this.model = fields?.model ?? this.model;
    this.streaming = fields?.streaming ?? this.streaming;
    this.temperature = fields?.temperature ?? this.temperature;
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
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
    };
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const params = this.invocationParams();
    const messagesMapped: HunyuanMessage[] = messages.map((message) => ({
      Role: messageToRole(message),
      Content: message.content as string,
    }));

    const data = params.Stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse;
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              ...params,
              Messages: messagesMapped,
            },
            true,
            options?.signal,
            (event) => {
              let error = "";
              let requestId = "";
              const data = JSON.parse(event.data);
              if (data?.Response?.Error?.Message) {
                error = data?.Response?.Error?.Message;
                requestId = data?.Response?.RequestId;
              } else if (data?.ErrorMsg?.Message) {
                // handle streaming error
                error = data?.ErrorMsg?.Message;
                requestId = data?.Id;
              }

              if (error) {
                if (rejected) {
                  return;
                }
                rejected = true;
                reject(new Error(`[${requestId}] ${error}`));
                return;
              }

              const { Content } = data.Choices[0].Delta;
              const { FinishReason } = data.Choices[0];

              // on the first message set the response properties
              if (!response) {
                response = {
                  Id: data.Id,
                  Created: data.Created,
                  Usage: data.Usage,
                  Note: data.Note,
                  RequestId: data.Id,
                  Choices: [
                    {
                      ...data.Choices[0],
                      Message: data.Choices[0].Delta,
                    },
                  ],
                };
              } else {
                response.Usage = data.Usage;
                response.Choices[0].Message.Content += Content;
              }

              void runManager?.handleLLMNewToken(Content ?? "");
              if (FinishReason) {
                if (resolved || rejected) {
                  return;
                }
                resolved = true;
                resolve(response);
              }
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
            Messages: messagesMapped,
          },
          false,
          options?.signal
        ).then<ChatCompletionResponse>((data) => {
          const response = data?.Response;
          if (response?.Error?.Message) {
            throw new Error(
              `[${response.RequestId}] ${response.Error.Message}`
            );
          }
          return response;
        });

    const {
      TotalTokens = 0,
      PromptTokens = 0,
      CompletionTokens = 0,
    } = data.Usage;

    const text = data.Choices[0]?.Message?.Content ?? "";
    const generations: ChatGeneration[] = [];
    generations.push({
      text,
      message: new AIMessage(text),
    });

    return {
      generations,
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
    stream: boolean,
    signal?: AbortSignal,
    onmessage?: (event: MessageEvent) => void
  ) {
    const makeCompletionRequest = async () => {
      const timestamp = Math.trunc(Date.now() / 1000);
      const headers = {
        "Content-Type": "application/json",
        "X-TC-Action": "ChatCompletions",
        "X-TC-Version": "2023-09-01",
        "X-TC-Timestamp": timestamp.toString(),
        Authorization: "",
      };

      headers.Authorization = sign(
        request,
        timestamp,
        this.tencentSecretId ?? "",
        this.tencentSecretKey ?? "",
        headers
      );

      const response = await fetch(`https://${host}`, {
        headers,
        method: "POST",
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
              const value = line.slice("data:".length).trim();
              const event = new MessageEvent("message", { data: value });
              onmessage?.(event);
            }
          }
        }
      }
    };
    return this.caller.call(makeCompletionRequest);
  }

  _llmType() {
    return "tencenthunyuan";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
