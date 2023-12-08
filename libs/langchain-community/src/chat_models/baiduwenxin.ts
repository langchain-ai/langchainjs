import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { AIMessage, BaseMessage, ChatMessage } from "@langchain/core/messages";
import { ChatGeneration, ChatResult } from "@langchain/core/outputs";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

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
 * Interface defining the input to the ChatBaiduWenxin class.
 */
declare interface BaiduWenxinChatInput {
  /** Model name to use. Available options are: ERNIE-Bot, ERNIE-Bot-turbo, ERNIE-Bot-4
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
 * To use you should have the `BAIDU_API_KEY` and `BAIDU_SECRET_KEY`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments BaiduERNIEInput
 * @example
 * ```typescript
 * const ernieTurbo = new ChatBaiduWenxin({
 *   baiduApiKey: "YOUR-API-KEY",
 *   baiduSecretKey: "YOUR-SECRET-KEY",
 * });
 *
 * const ernie = new ChatBaiduWenxin({
 *   modelName: "ERNIE-Bot",
 *   temperature: 1,
 *   baiduApiKey: "YOUR-API-KEY",
 *   baiduSecretKey: "YOUR-SECRET-KEY",
 * });
 *
 * const messages = [new HumanMessage("Hello")];
 *
 * let res = await ernieTurbo.call(messages);
 *
 * res = await ernie.call(messages);
 * ```
 */
export class ChatBaiduWenxin
  extends BaseChatModel
  implements BaiduWenxinChatInput
{
  static lc_name() {
    return "ChatBaiduWenxin";
  }

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
    } else if (this.modelName === "ERNIE-Bot-turbo") {
      this.apiUrl =
        "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant";
    } else if (this.modelName === "ERNIE-Bot-4") {
      this.apiUrl =
        "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro";
    } else {
      throw new Error(`Invalid model name: ${this.modelName}`);
    }
  }

  /**
   * Method that retrieves the access token for making requests to the Baidu
   * API.
   * @param options Optional parsed call options.
   * @returns The access token for making requests to the Baidu API.
   */
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

    // Wenxin requires the system message to be put in the params, not messages array
    const systemMessage = messages.find(
      (message) => message._getType() === "system"
    );
    if (systemMessage) {
      // eslint-disable-next-line no-param-reassign
      messages = messages.filter((message) => message !== systemMessage);
      params.system = systemMessage.text;
    }
    const messagesMapped: WenxinMessage[] = messages.map((message) => ({
      role: messageToWenxinRole(message),
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
                reject(new Error(data?.error_msg));
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
          // response will not be a stream if an error occurred
          if (
            !response.headers
              .get("content-type")
              ?.startsWith("text/event-stream")
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
