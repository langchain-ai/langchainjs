import { BaseChatModel, BaseChatModelParams } from "./base.js";
import {
  AIMessage,
  BaseMessage,
  ChatGeneration,
  ChatResult,
  MessageType,
} from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { getEnvironmentVariable } from "../util/env.js";

export type WenxinMessageRole = "assistant" | "user";

interface WenxinMessage {
  role: WenxinMessageRole;
  content: string;
}

interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

interface ChatCompletionRequest {
  messages: WenxinMessage[];
  stream?: boolean;
  user_id?: string;
  temperature?: number;
  top_p?: number;
  penalty_score?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  result: string;
  need_clear_history: boolean;
  usage: TokenUsage;
}

declare interface BaiduWenxinChatInput {
  /** Model name to use
   * @default "ERNIE-Bot-turbo"
   */
  modelName: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  prefixMessages?: WenxinMessage[];

  /**
   * ID of the end-user who made requests.
   */
  userId?: string;

  /**
   * API key to use when making requests. Defaults to the value of
   * `BAIDU_API_KEY` environment variable.
   */
  baiduApiKey?: string;

  /**
   * Secret key to use when making requests. Defaults to the value of
   * `BAIDU_SECRET_KEY` environment variable.
   */
  baiduSecretKey?: string;

  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks. Defaults to 0.95.
   * Only supported for `modelName` of `WenxinModelName.ERNIE_BOT`.
   */
  temperature?: number;

  /** Total probability mass of tokens to consider at each step. Range
   * from 0 to 1.0. Defaults to 0.8.
   * Only supported for `modelName` of `WenxinModelName.ERNIE_BOT`.
   */
  topP?: number;

  /** Penalizes repeated tokens according to frequency. Range
   * from 1.0 to 2.0. Defaults to 1.0.
   * Only supported for `modelName` of `WenxinModelName.ERNIE_BOT`.
   */
  penaltyScore?: number;
}

function messageTypeToWenxinRole(type: MessageType): WenxinMessageRole {
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      throw new Error("System messages not supported");
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Wrapper around Baidu ERNIE large language models that use the Chat endpoint.
 *
 * To use you should have the `BAIDU_API_KEY` and `BAIDU_SECRET_KEY`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments BaiduERNIEInput
 */
export class ChatBaiduWenxin
  extends BaseChatModel
  implements BaiduWenxinChatInput
{
  declare CallOptions: BaseLanguageModelCallOptions;

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      baiduApiKey: "BAIDU_API_KEY",
      baiduSecretKey: "BAIDU_SECRET_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  baiduApiKey?: string;

  baiduSecretKey?: string;

  accessToken: string;

  streaming = false;

  prefixMessages?: WenxinMessage[];

  userId?: string;

  modelName = "ERNIE-Bot-turbo";

  apiUrl: string;

  temperature?: number | undefined;

  topP?: number | undefined;

  penaltyScore?: number | undefined;

  constructor(fields?: Partial<BaiduWenxinChatInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.baiduApiKey =
      fields?.baiduApiKey ?? getEnvironmentVariable("BAIDU_API_KEY");
    if (!this.baiduApiKey) {
      throw new Error("Baidu API key not found");
    }

    this.baiduSecretKey =
      fields?.baiduSecretKey ?? getEnvironmentVariable("BAIDU_SECRET_KEY");
    if (!this.baiduSecretKey) {
      throw new Error("Baidu Secret key not found");
    }

    this.streaming = fields?.streaming ?? this.streaming;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.userId = fields?.userId ?? this.userId;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.penaltyScore = fields?.penaltyScore ?? this.penaltyScore;

    this.modelName = fields?.modelName ?? this.modelName;

    if (this.modelName === "ERNIE-Bot") {
      this.apiUrl =
        "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions";
      this.temperature = this.temperature ?? 0.95;
      this.topP = this.topP ?? 0.8;
      this.penaltyScore = this.penaltyScore ?? 1.0;
    } else if (this.modelName === "ERNIE-Bot-turbo") {
      this.apiUrl =
        "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant";
      // Validate the input
      if (this.temperature) {
        throw new Error(
          "Temperature is not supported forERNIE-Bot-turbo model"
        );
      }
      if (this.topP) {
        throw new Error("TopP is not supported for ERNIE-Bot-turbo model");
      }
      if (this.penaltyScore) {
        throw new Error(
          "PenaltyScore is not supported for ERNIE-Bot-turbo model"
        );
      }
    } else {
      throw new Error(`Invalid model name: ${this.modelName}`);
    }
  }

  async getAccessToken(options?: this["ParsedCallOptions"]) {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.baiduApiKey}&client_secret=${this.baiduSecretKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: options?.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(
        `Baidu get access token failed with status code ${response.status}, response: ${text}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }
    const json = await response.json();
    return json.access_token;
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
      model_name: this.modelName,
      ...this.invocationParams(),
    };
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const tokenUsage: TokenUsage = {};

    const params = this.invocationParams();
    const messagesMapped: WenxinMessage[] = messages.map((message) => ({
      role: messageTypeToWenxinRole(message._getType()),
      content: message.text,
    }));

    const data = params.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse;
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
              const data = JSON.parse(event.data);

              if (data?.error_code) {
                if (rejected) {
                  return;
                }
                rejected = true;
                reject(data);
                return;
              }

              const message = data as {
                id: string;
                object: string;
                created: number;
                sentence_id?: number;
                is_end: boolean;
                result: string;
                need_clear_history: boolean;
                usage: TokenUsage;
              };

              // on the first message set the response properties
              if (!response) {
                response = {
                  id: message.id,
                  object: message.object,
                  created: message.created,
                  result: message.result,
                  need_clear_history: message.need_clear_history,
                  usage: message.usage,
                };
              } else {
                response.result += message.result;
                response.created = message.created;
                response.need_clear_history = message.need_clear_history;
                response.usage = message.usage;
              }

              // TODO this should pass part.index to the callback
              // when that's supported there
              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(message.result ?? "");

              if (message.is_end) {
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
            messages: messagesMapped,
          },
          false,
          options?.signal
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
  async completionWithRetry(
    request: ChatCompletionRequest,
    stream: boolean,
    signal?: AbortSignal,
    onmessage?: (event: MessageEvent) => void
  ) {
    // The first run will get the accessToken
    if (!this.accessToken) {
      this.accessToken = await this.getAccessToken();
    }

    const makeCompletionRequest = async () => {
      const url = `${this.apiUrl}?access_token=${this.accessToken}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal,
      });

      if (!stream) {
        return response.json();
      } else {
        if (response.body) {
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
      }
    };
    return this.caller.call(makeCompletionRequest);
  }

  _llmType() {
    return "baiduwenxin";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
