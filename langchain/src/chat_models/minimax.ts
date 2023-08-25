import { BaseChatModel, BaseChatModelParams } from "./base.js";
import {
  AIMessage,
  BaseMessage,
  ChatGeneration,
  ChatMessage,
  ChatResult,
} from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { getEnvironmentVariable } from "../util/env.js";

/**
 * Type representing the sender_type of a message in the Wenxin chat model.
 */
export type MessageRole = "BOT" | "USER";

/**
 * Interface representing a message in the Wenxin chat model.
 */
interface Message {
  sender_type: MessageRole;
  text: string;
}

/**
 * Interface representing the usage of tokens in a chat completion.
 */
interface TokenUsage {
  total_tokens?: number;
}

/**
 * Interface representing a request for a chat completion.
 */
interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  prompt?: string;
  temperature?: number;
  top_p?: number;
  skip_info_mask?: boolean;
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  reply: string;
  input_sensitive: boolean;
  usage: TokenUsage;
}

/**
 * Interface defining the input to the ChatMinimax class.
 */
declare interface MinimaxChatInput {
  /** Model name to use
   * @default "ERNIE-Bot-turbo"
   */
  modelName: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /**
   * ID of the end-user who made requests.
   */
  prompt?: string;

  /**
   * API key to use when making requests. Defaults to the value of
   * `BAIDU_API_KEY` environment variable.
   */
  minimaxGroupId?: string;

  /**
   * Secret key to use when making requests. Defaults to the value of
   * `BAIDU_SECRET_KEY` environment variable.
   */
  minimaxApiKey?: string;

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
  skipInfoMask?: boolean;
}

/**
 * Function that extracts the custom sender_type of a generic chat message.
 * @param message Chat message from which to extract the custom sender_type.
 * @returns The custom sender_type of the chat message.
 */
function extractGenericMessageCustomRole(message: ChatMessage) {
  if (message.role !== "BOT" && message.role !== "USER") {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as MessageRole;
}

/**
 * Function that converts a base message to a Wenxin message sender_type.
 * @param message Base message to convert.
 * @returns The Wenxin message sender_type.
 */
function messageToMinimaxRole(message: BaseMessage): MessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "BOT";
    case "human":
      return "USER";
    case "system":
      throw new Error("System messages not supported");
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
 */
export class ChatMinimax extends BaseChatModel implements MinimaxChatInput {
  static lc_name() {
    return "ChatMinimax";
  }

  get callKeys(): string[] {
    return ["stop", "signal", "options"];
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      minimaxApiKey: "MINIMAX_API_KEY",
      minimaxGroupId: "MINIMAX_GROUP_ID",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  lc_serializable = true;

  minimaxGroupId?: string;

  minimaxApiKey?: string;

  streaming = false;

  prompt?: string;

  modelName = "abab5-chat";

  apiUrl: string;

  temperature?: number | undefined;

  topP?: number | undefined;

  skipInfoMask?: boolean | undefined;

  constructor(fields?: Partial<MinimaxChatInput> & BaseChatModelParams) {
    super(fields ?? {});

    this.minimaxGroupId =
      fields?.minimaxGroupId ?? getEnvironmentVariable("MINIMAX_GROUP_ID");
    if (!this.minimaxGroupId) {
      throw new Error("Baidu API key not found");
    }

    this.minimaxApiKey =
      fields?.minimaxApiKey ?? getEnvironmentVariable("MINIMAX_API_KEY");
    if (!this.minimaxApiKey) {
      throw new Error("Baidu Secret key not found");
    }

    this.streaming = fields?.streaming ?? this.streaming;
    this.prompt = fields?.prompt ?? this.prompt;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.skipInfoMask = fields?.skipInfoMask ?? this.skipInfoMask;

    this.modelName = fields?.modelName ?? this.modelName;
    this.apiUrl = `https://api.minimax.chat/v1/text/chatcompletion`;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, "messages"> {
    return {
      model: this.modelName,
      stream: this.streaming,
      prompt: this.prompt,
      temperature: this.temperature,
      top_p: this.topP,
      skip_info_mask: this.skipInfoMask,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
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
    const messagesMapped: Message[] = messages.map((message) => ({
      sender_type: messageToMinimaxRole(message),
      text: message.content,
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
                  reply: message.result,
                  input_sensitive: message.need_clear_history,
                  usage: message.usage,
                };
              } else {
                response.reply += message.result;
                response.created = message.created;
                response.input_sensitive = message.need_clear_history;
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

    const { total_tokens: totalTokens } = data.usage ?? {};

    if (totalTokens) {
      tokenUsage.total_tokens = (tokenUsage.total_tokens ?? 0) + totalTokens;
    }

    const generations: ChatGeneration[] = [];
    const text = data.reply ?? "";
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
    const makeCompletionRequest = async () => {
      const url = `${this.apiUrl}?GroupId=${this.minimaxGroupId}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + this.minimaxApiKey,
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
    return "minimax";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
