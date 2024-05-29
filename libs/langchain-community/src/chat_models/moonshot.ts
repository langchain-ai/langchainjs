import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import { type ChatResult } from "@langchain/core/outputs";
import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export type MoonshotMessageRole = "system" | "assistant" | "user";

interface MoonshotMessage {
  role: MoonshotMessageRole;
  content: string;
}

/**
 * Interface representing a request for a chat completion.
 *
 * See https://platform.moonshot.cn/docs/intro#%E6%A8%A1%E5%9E%8B%E5%88%97%E8%A1%A8
 */
type ModelName =
  | (string & NonNullable<unknown>)
  | "moonshot-v1-8k" // context size: 8k
  | "moonshot-v1-32k" // context size: 32k
  | "moonshot-v1-128k"; // context size: 128k
interface ChatCompletionRequest {
  model: ModelName;
  messages?: MoonshotMessage[];
  stream?: boolean;
  max_tokens?: number | null;
  top_p?: number | null;
  temperature?: number | null;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  n?: number;
}

interface BaseResponse {
  code?: string;
  message?: string;
}

interface ChoiceMessage {
  role: string;
  content: string;
}

interface ResponseChoice {
  index: number;
  finish_reason: "stop" | "length" | "null" | null;
  delta: ChoiceMessage;
  message: ChoiceMessage;
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse extends BaseResponse {
  choices: ResponseChoice[];
  created: number;
  id: string;
  model: string;
  request_id: string;
  usage: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };
  output: {
    text: string;
    finish_reason: "stop" | "length" | "null" | null;
  };
}

/**
 * Interface defining the input to the MoonshotChatInput class.
 */
export interface ChatMoonshotParams {
  /**
   * @default "moonshot-v1-8k"
   * Alias for `model`
   */
  modelName: ModelName;
  /**
   * @default "moonshot-v1-8k"
   */
  model: ModelName;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  messages?: MoonshotMessage[];

  /**
   * API key to use when making requests. Defaults to the value of
   * `MOONSHOT_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative and generative tasks.
   * Defaults to 0, recommended 0.3
   */
  temperature?: number;

  /**
   * Total probability mass of tokens to consider at each step. Range
   * from 0 to 1. Defaults to 1
   */
  topP?: number;

  /**
   * Different models have different maximum values. For example, the maximum
   * value of moonshot-v1-8k is 8192. Defaults to 1024
   */
  maxTokens?: number;

  stop?: string[];

  /**
   * There is a penalty, a number between -2.0 and 2.0. Positive values
   * penalize the newly generated words based on whether they appear in the
   * text, increasing the likelihood that the model will discuss new topics.
   * The default value is 0
   */
  presencePenalty?: number;

  /**
   * Frequency penalty, a number between -2.0 and 2.0. Positive values
   * penalize the newly generated words based on their existing frequency in the
   * text, making the model less likely to repeat the same words verbatim.
   * The default value is 0
   */
  frequencyPenalty?: number;

  /**
   * The default value is 1 and cannot be greater than 5. In particular,
   * when temperature is very small and close to 0, we can only return 1 result.
   * If n is already set and > 1, Moonshot will return an invalid input parameter
   * (invalid_request_error).
   */
  n?: number;
}

function messageToRole(message: BaseMessage): MoonshotMessageRole {
  const type = message._getType();
  switch (type) {
    case "ai":
      return "assistant";
    case "human":
      return "user";
    case "system":
      return "system";
    case "function":
      throw new Error("Function messages not supported yet");
    case "generic": {
      if (!ChatMessage.isInstance(message)) {
        throw new Error("Invalid generic chat message");
      }
      if (["system", "assistant", "user"].includes(message.role)) {
        return message.role as MoonshotMessageRole;
      }
      throw new Error(`Unknown message type: ${type}`);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export class ChatMoonshot extends BaseChatModel implements ChatMoonshotParams {
  static lc_name() {
    return "ChatMoonshot";
  }

  get callKeys() {
    return ["stop", "signal", "options"];
  }

  get lc_secrets() {
    return {
      apiKey: "MOONSHOT_API_KEY",
    };
  }

  get lc_aliases() {
    return undefined;
  }

  apiKey?: string;

  streaming: boolean;

  messages?: MoonshotMessage[];

  modelName: ChatCompletionRequest["model"];

  model: ChatCompletionRequest["model"];

  apiUrl: string;

  maxTokens?: number | undefined;

  temperature?: number | undefined;

  topP?: number | undefined;

  stop?: string[];

  presencePenalty?: number;

  frequencyPenalty?: number;

  n?: number;

  constructor(fields: Partial<ChatMoonshotParams> & BaseChatModelParams = {}) {
    super(fields);

    this.apiKey = fields?.apiKey ?? getEnvironmentVariable("MOONSHOT_API_KEY");

    if (!this.apiKey) {
      throw new Error("Moonshot API key not found");
    }

    this.apiUrl = "https://api.moonshot.cn/v1/chat/completions";
    this.streaming = fields.streaming ?? false;
    this.messages = fields.messages ?? [];
    this.temperature = fields.temperature ?? 0;
    this.topP = fields.topP ?? 1;
    this.stop = fields.stop;
    this.maxTokens = fields.maxTokens;
    this.modelName = fields?.model ?? fields.modelName ?? "moonshot-v1-8k";
    this.model = this.modelName;
    this.presencePenalty = fields.presencePenalty ?? 0;
    this.frequencyPenalty = fields.frequencyPenalty ?? 0;
    this.n = fields.n ?? 1;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, "messages"> {
    return {
      model: this.model,
      stream: this.streaming,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
      stop: this.stop,
      presence_penalty: this.presencePenalty,
      frequency_penalty: this.frequencyPenalty,
      n: this.n,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams(): Omit<ChatCompletionRequest, "messages"> {
    return this.invocationParams();
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const parameters = this.invocationParams();

    const messagesMapped: MoonshotMessage[] = messages.map((message) => ({
      role: messageToRole(message),
      content: message.content as string,
    }));

    const data = parameters.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse;
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              ...parameters,
              messages: messagesMapped,
            },
            true,
            options?.signal,
            (event) => {
              const data: ChatCompletionResponse = JSON.parse(event.data);
              if (data?.code) {
                if (rejected) {
                  return;
                }
                rejected = true;
                reject(new Error(data?.message));
                return;
              }

              const { delta, finish_reason } = data.choices[0];
              const text = delta.content;

              if (!response) {
                response = {
                  ...data,
                  output: { text, finish_reason },
                };
              } else {
                response.output.text += text;
                response.output.finish_reason = finish_reason;
                response.usage = data.usage;
              }

              void runManager?.handleLLMNewToken(text ?? "");
              if (finish_reason && finish_reason !== "null") {
                if (resolved || rejected) return;
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
            ...parameters,
            messages: messagesMapped,
          },
          false,
          options?.signal
        ).then<ChatCompletionResponse>((data) => {
          if (data?.code) {
            throw new Error(data?.message);
          }
          const { finish_reason, message } = data.choices[0];
          const text = message.content;
          return {
            ...data,
            output: { text, finish_reason },
          };
        });

    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
    } = data.usage ?? {};

    const { text } = data.output;

    return {
      generations: [
        {
          text,
          message: new AIMessage(text),
        },
      ],
      llmOutput: {
        tokenUsage: {
          promptTokens: prompt_tokens,
          completionTokens: completion_tokens,
          totalTokens: total_tokens,
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
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          ...(stream ? { Accept: "text/event-stream" } : {}),
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
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
              if (value === "[DONE]") {
                continueReading = false;
                break;
              }
              const event = new MessageEvent("message", { data: value });
              onmessage?.(event);
            }
          }
        }
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  _llmType(): string {
    return "moonshot";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
