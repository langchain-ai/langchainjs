import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  type BaseMessage,
  ChatMessage,
  AIMessageChunk,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { encodeApiKey } from "../utils/zhipuai.js";
import { convertEventStreamToIterableReadableDataStream } from "../utils/event_source_parse.js";

export type ZhipuMessageRole = "system" | "assistant" | "user";

interface ZhipuMessage {
  role: ZhipuMessageRole;
  content: string;
}

/**
 * Interface representing a request for a chat completion.
 *
 * See https://open.bigmodel.cn/dev/howuse/model
 */
type ModelName =
  | (string & NonNullable<unknown>)
  // will be deprecated models
  | "chatglm_pro" // deprecated in 2024-12-31T23:59:59+0800，point to glm-4
  | "chatglm_std" // deprecated in 2024-12-31T23:59:59+0800，point to glm-3-turbo
  | "chatglm_lite" // deprecated in 2024-12-31T23:59:59+0800，point to glm-3-turbo
  // GLM-4 more powerful on Q/A and text generation, suitable for complex dialog interactions and deep content creation design.
  | "glm-4" // context size: 128k
  | "glm-4v" // context size: 2k
  // ChatGLM-Turbo
  | "glm-3-turbo" // context size: 128k
  | "chatglm_turbo"; // context size: 32k
interface ChatCompletionRequest {
  model: ModelName;
  messages?: ZhipuMessage[];
  do_sample?: boolean;
  stream?: boolean;
  request_id?: string;
  max_tokens?: number | null;
  top_p?: number | null;
  top_k?: number | null;
  temperature?: number | null;
  stop?: string[];
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

interface ZhipuAIError {
  error: BaseResponse;
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse extends ZhipuAIError {
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
 * Interface defining the input to the ZhipuAIChatInput class.
 */
export interface ChatZhipuAIParams {
  /**
   * @default "glm-3-turbo"
   * Alias for `model`
   */
  modelName: ModelName;
  /**
   * @default "glm-3-turbo"
   */
  model: ModelName;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  messages?: ZhipuMessage[];

  /**
   * API key to use when making requests. Defaults to the value of
   * `ZHIPUAI_API_KEY` environment variable.
   * Alias for `apiKey`
   */
  zhipuAIApiKey?: string;

  /**
   * API key to use when making requests. Defaults to the value of
   * `ZHIPUAI_API_KEY` environment variable.
   */
  apiKey?: string;

  /** Amount of randomness injected into the response. Ranges
   * from 0 to 1 (0 is not included). Use temp closer to 0 for analytical /
   * multiple choice, and temp closer to 1 for creative
   * and generative tasks. Defaults to 0.95
   */
  temperature?: number;

  /** Total probability mass of tokens to consider at each step. Range
   * from 0 to 1 Defaults to 0.7
   */
  topP?: number;

  /**
   * Unique identifier for the request. Defaults to a random UUID.
   */
  requestId?: string;

  /**
   * turn on sampling strategy when do_sample is true,
   * do_sample is false, temperature、top_p will not take effect
   */
  doSample?: boolean;

  /**
   * max value is 8192，defaults to 1024
   */
  maxTokens?: number;

  stop?: string[];
}

function messageToRole(message: BaseMessage): ZhipuMessageRole {
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
        return message.role as ZhipuMessageRole;
      }
      throw new Error(`Unknown message type: ${type}`);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export class ChatZhipuAI extends BaseChatModel implements ChatZhipuAIParams {
  static lc_name() {
    return "ChatZhipuAI";
  }

  get callKeys() {
    return ["stop", "signal", "options"];
  }

  get lc_secrets() {
    return {
      zhipuAIApiKey: "ZHIPUAI_API_KEY",
      apiKey: "ZHIPUAI_API_KEY",
    };
  }

  get lc_aliases() {
    return undefined;
  }

  zhipuAIApiKey?: string;

  apiKey?: string;

  streaming: boolean;

  doSample?: boolean;

  messages?: ZhipuMessage[];

  requestId?: string;

  modelName: ChatCompletionRequest["model"];

  model: ChatCompletionRequest["model"];

  apiUrl: string;

  maxTokens?: number | undefined;

  temperature?: number | undefined;

  topP?: number | undefined;

  stop?: string[];

  constructor(fields: Partial<ChatZhipuAIParams> & BaseChatModelParams = {}) {
    super(fields);

    this.zhipuAIApiKey =
      fields?.apiKey ??
      fields?.zhipuAIApiKey ??
      getEnvironmentVariable("ZHIPUAI_API_KEY");
    if (!this.zhipuAIApiKey) {
      throw new Error("ZhipuAI API key not found");
    }

    this.apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    this.streaming = fields.streaming ?? false;
    this.messages = fields.messages ?? [];
    this.temperature = fields.temperature ?? 0.95;
    this.topP = fields.topP ?? 0.7;
    this.stop = fields.stop;
    this.maxTokens = fields.maxTokens;
    this.modelName = fields?.model ?? fields.modelName ?? "glm-3-turbo";
    this.model = this.modelName;
    this.doSample = fields.doSample;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<ChatCompletionRequest, "messages"> {
    return {
      model: this.model,
      request_id: this.requestId,
      do_sample: this.doSample,
      stream: this.streaming,
      temperature: this.temperature,
      top_p: this.topP,
      max_tokens: this.maxTokens,
      stop: this.stop,
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

    const messagesMapped: ZhipuMessage[] = messages.map((message) => ({
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
              if (data?.error?.code) {
                if (rejected) {
                  return;
                }
                rejected = true;
                reject(new Error(data?.error?.message));
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
          if (data?.error?.code) {
            throw new Error(data?.error?.message);
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
    } = data.usage;

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
          Authorization: `Bearer ${encodeApiKey(this.zhipuAIApiKey)}`,
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

  private async createZhipuStream(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${encodeApiKey(this.zhipuAIApiKey)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.body) {
      throw new Error(
        "Could not begin Zhipu stream. Please check the given URL and try again."
      );
    }

    return convertEventStreamToIterableReadableDataStream(response.body);
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

    const messagesMapped: ZhipuMessage[] = messages.map((message) => ({
      role: messageToRole(message),
      content: message.content as string,
    }));

    const stream = await this.caller.call(async () =>
      this.createZhipuStream(
        {
          ...parameters,
          messages: messagesMapped,
        },
        options?.signal
      )
    );

    for await (const chunk of stream) {
      if (chunk !== "[DONE]") {
        const deserializedChunk = this._deserialize(chunk);
        const { choices, usage, id } = deserializedChunk;
        const text = choices[0]?.delta?.content ?? "";
        const finished = !!choices[0]?.finish_reason;
        yield new ChatGenerationChunk({
          text,
          message: new AIMessageChunk({ content: text }),
          generationInfo: finished
            ? {
                finished,
                request_id: id,
                // The usage of tokens is counted at the end of the stream
                usage,
              }
            : undefined,
        });
        await runManager?.handleLLMNewToken(text);
      } else {
        continue;
      }
    }
  }

  _llmType(): string {
    return "zhipuai";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
