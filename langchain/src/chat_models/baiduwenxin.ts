import axiosMod, { AxiosResponse, AxiosStatic } from "axios";
import { BaseChatModel, BaseChatModelParams } from "./base.js";
import {
  AIChatMessage,
  BaseChatMessage,
  ChatGeneration,
  ChatResult,
  MessageType,
} from "../schema/index.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import type { StreamingAxiosConfiguration } from "../util/axios-types.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { getEnvironmentVariable, isNode } from "../util/env.js";

const axios = (
  "default" in axiosMod ? axiosMod.default : axiosMod
) as AxiosStatic;

enum WenxinMessageRole {
  AI = "assistant",
  HUMAN = "user",
}

export enum WenxinModelName {
  ERNIE_BOT = "ERNIE-Bot",
  ERNIE_BOT_TURBO = "ERNIE-Bot-turbo",
}

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
   * @default WenxinModelName.ERNIE_BOT_TURBO
   */
  modelName: WenxinModelName;

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
   * `BAIDU_ERNIE_API_KEY` environment variable.
   */
  baiduErnieApiKey?: string;

  /**
   * Secret key to use when making requests. Defaults to the value of
   * `BAIDU_ERNIE_SECRET_KEY` environment variable.
   */
  baiduErnieSecretKey?: string;

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
      return WenxinMessageRole.AI;
    case "human":
      return WenxinMessageRole.HUMAN;
    case "system":
      throw new Error("System messages not supported");
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Wrapper around Baidu ERNIE large language models that use the Chat endpoint.
 *
 * To use you should have the `BAIDU_ERNIE_API_KEY` and `BAIDU_ERNIE_SECRET_KEY`
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
      baiduErnieApiKey: "BAIDU_ERNIE_API_KEY",
      baiduErnieSecretKey: "BAIDU_ERNIE_SECRET_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  baiduErnieApiKey?: string;

  baiduErnieSecretKey?: string;

  accessToken: string;

  streaming?: boolean;

  prefixMessages?: WenxinMessage[];

  userId?: string;

  modelName: WenxinModelName = WenxinModelName.ERNIE_BOT_TURBO;

  apiUrl: string;

  temperature?: number | undefined;

  topP?: number | undefined;

  penaltyScore?: number | undefined;

  constructor(fields?: Partial<BaiduWenxinChatInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.baiduErnieApiKey =
      fields?.baiduErnieApiKey ?? getEnvironmentVariable("BAIDU_ERNIE_API_KEY");
    if (!this.baiduErnieApiKey) {
      throw new Error("Baidu ERNIE API key not found");
    }

    this.baiduErnieSecretKey =
      fields?.baiduErnieSecretKey ??
      getEnvironmentVariable("BAIDU_ERNIE_SECRET_KEY");
    if (!this.baiduErnieSecretKey) {
      throw new Error("Baidu ERNIE Secret key not found");
    }

    this.streaming = fields?.streaming ?? this.streaming;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.userId = fields?.userId ?? this.userId;

    this.modelName = fields?.modelName ?? this.modelName;

    switch (this.modelName) {
      case WenxinModelName.ERNIE_BOT:
        this.apiUrl =
          "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions";
        break;
      case WenxinModelName.ERNIE_BOT_TURBO:
        this.apiUrl =
          "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant";
        break;
      default:
        throw new Error(`Invalid model name: ${this.modelName}`);
    }

    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.penaltyScore = fields?.penaltyScore ?? this.penaltyScore;

    // Validate the input
    if (this.modelName === WenxinModelName.ERNIE_BOT_TURBO) {
      if (this.temperature) {
        throw new Error(
          "Temperature is not supported for ERNIE_BOT_TURBO model"
        );
      }
      if (this.topP) {
        throw new Error("TopP is not supported for ERNIE_BOT_TURBO model");
      }
      if (this.penaltyScore) {
        throw new Error(
          "PenaltyScore is not supported for ERNIE_BOT_TURBO model"
        );
      }
    }
  }

  async getAccessToken() {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.baiduErnieApiKey}&client_secret=${this.baiduErnieSecretKey}`;
    const response: AxiosResponse = await axios.post(
      url,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return response.data?.access_token ?? "";
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
    messages: BaseChatMessage[],
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
            {
              signal: options?.signal,
              adapter: fetchAdapter, // default adapter doesn't do streaming
              responseType: "stream",
              onmessage: (event) => {
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
    const text = data.result ?? "";
    generations.push({
      text,
      message: new AIChatMessage(text),
    });
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  /** @ignore */
  async completionWithRetry(
    request: ChatCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    // The first run will get the accessToken
    if (!this.accessToken) {
      this.accessToken = await this.getAccessToken();
    }

    const axiosOptions = {
      params: { access_token: this.accessToken },
      headers: { "Content-Type": "application/json" },
      adapter: isNode() ? undefined : fetchAdapter,
      ...options,
    } as StreamingAxiosConfiguration;

    const makeCompletionRequest = async () => {
      const res = await axios.post(this.apiUrl, request, axiosOptions);
      return res.data;
    };
    return this.caller.call(makeCompletionRequest);
  }

  _llmType() {
    return "ernie";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
