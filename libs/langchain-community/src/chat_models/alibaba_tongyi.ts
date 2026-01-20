import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
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
import { type ChatResult } from "@langchain/core/outputs";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { IterableReadableStream } from "@langchain/core/utils/stream";

/**
 * Type representing the role of a message in the Tongyi chat model.
 */
export type TongyiMessageRole = "system" | "assistant" | "user";

/**
 * Interface representing a message in the Tongyi chat model.
 */
interface TongyiMessage {
  role: TongyiMessageRole;
  content: string;
}

/**
 * Interface representing a request for a chat completion.
 *
 * See https://help.aliyun.com/zh/dashscope/developer-reference/model-square/
 */
interface ChatCompletionRequest {
  model:
    | (string & NonNullable<unknown>)
    | "qwen-turbo"
    | "qwen-plus"
    | "qwen-max"
    | "qwen-max-1201"
    | "qwen-max-longcontext"
    // 通义千问开源系列
    | "qwen-7b-chat"
    | "qwen-14b-chat"
    | "qwen-72b-chat"
    // LLAMA2
    | "llama2-7b-chat-v2"
    | "llama2-13b-chat-v2"
    // 百川
    | "baichuan-7b-v1"
    | "baichuan2-13b-chat-v1"
    | "baichuan2-7b-chat-v1"
    // ChatGLM
    | "chatglm3-6b"
    | "chatglm-6b-v2";
  input: {
    messages: TongyiMessage[];
  };
  parameters: {
    stream?: boolean;
    result_format?: "text" | "message";
    seed?: number | null;
    max_tokens?: number | null;
    top_p?: number | null;
    top_k?: number | null;
    repetition_penalty?: number | null;
    temperature?: number | null;
    enable_search?: boolean | null;
    incremental_output?: boolean | null;
  };
}

/**
 * Interface representing a response from a chat completion.
 */
interface ChatCompletionResponse {
  code?: string;
  message?: string;
  request_id: string;
  usage: {
    output_tokens: number;
    input_tokens: number;
    total_tokens: number;
  };
  output: {
    text: string;
    finish_reason: "stop" | "length" | "null" | null;
  };
}

/**
 * Interface defining the input to the ChatAlibabaTongyi class.
 */
interface AlibabaTongyiChatInput {
  /**
   * Model name to use. Available options are: qwen-turbo, qwen-plus, qwen-max, or Other compatible models.
   * Alias for `model`
   * @default "qwen-turbo"
   */
  modelName: string;

  /** Model name to use. Available options are: qwen-turbo, qwen-plus, qwen-max, or Other compatible models.
   * @default "qwen-turbo"
   */
  model: string;

  /** Whether to stream the results or not. Defaults to false. */
  streaming?: boolean;

  /** Messages to pass as a prefix to the prompt */
  prefixMessages?: TongyiMessage[];

  /**
   * API key to use when making requests. Defaults to the value of
   * `ALIBABA_API_KEY` environment variable.
   */
  alibabaApiKey?: string;

  /**
   * Region for the Alibaba Tongyi API endpoint.
   *
   * Available regions:
   * - 'china' (default): https://dashscope.aliyuncs.com/compatible-mode/v1
   * - 'singapore': https://dashscope-intl.aliyuncs.com/compatible-mode/v1
   * - 'us': https://dashscope-us.aliyuncs.com/compatible-mode/v1
   *
   * @default "china"
   */
  region?: "china" | "singapore" | "us";

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

  topK?: number;

  enableSearch?: boolean;

  maxTokens?: number;

  seed?: number;

  /** Penalizes repeated tokens according to frequency. Range
   * from 1.0 to 2.0. Defaults to 1.0.
   */
  repetitionPenalty?: number;
}

/**
 * Function that extracts the custom role of a generic chat message.
 * @param message Chat message from which to extract the custom role.
 * @returns The custom role of the chat message.
 */
function extractGenericMessageCustomRole(message: ChatMessage) {
  if (["system", "assistant", "user"].includes(message.role) === false) {
    console.warn(`Unknown message role: ${message.role}`);
  }

  return message.role as TongyiMessageRole;
}

/**
 * Function that converts a base message to a Tongyi message role.
 * @param message Base message to convert.
 * @returns The Tongyi message role.
 */
function messageToTongyiRole(message: BaseMessage): TongyiMessageRole {
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
      if (!ChatMessage.isInstance(message))
        throw new Error("Invalid generic chat message");
      return extractGenericMessageCustomRole(message);
    }
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Wrapper around Ali Tongyi large language models that use the Chat endpoint.
 *
 * To use you should have the `ALIBABA_API_KEY`
 * environment variable set.
 *
 * @augments BaseLLM
 * @augments AlibabaTongyiInput
 * @example
 * ```typescript
 * // Default - uses China region
 * const qwen = new ChatAlibabaTongyi({
 *   alibabaApiKey: "YOUR-API-KEY",
 * });
 *
 * // Specify region explicitly
 * const qwen = new ChatAlibabaTongyi({
 *   model: "qwen-turbo",
 *   temperature: 1,
 *   region: "singapore", // or "us" or "china"
 *   alibabaApiKey: "YOUR-API-KEY",
 * });
 *
 * const messages = [new HumanMessage("Hello")];
 *
 * await qwen.call(messages);
 * ```
 */
export class ChatAlibabaTongyi
  extends BaseChatModel
  implements AlibabaTongyiChatInput
{
  static lc_name() {
    return "ChatAlibabaTongyi";
  }

  get callKeys() {
    return ["stop", "signal", "options"];
  }

  get lc_secrets() {
    return {
      alibabaApiKey: "ALIBABA_API_KEY",
    };
  }

  get lc_aliases() {
    return undefined;
  }

  lc_serializable: boolean;

  alibabaApiKey?: string;

  streaming: boolean;

  prefixMessages?: TongyiMessage[];

  modelName: ChatCompletionRequest["model"];

  model: ChatCompletionRequest["model"];

  apiUrl: string;

  maxTokens?: number | undefined;

  temperature?: number | undefined;

  topP?: number | undefined;

  topK?: number | undefined;

  repetitionPenalty?: number | undefined;

  seed?: number | undefined;

  enableSearch?: boolean | undefined;

  region: "china" | "singapore" | "us";

  /**
   * Get the API URL based on the specified region.
   *
   * @param region - The region to get the URL for ('china', 'singapore', or 'us')
   * @returns The base URL for the specified region
   */
  private getRegionBaseUrl(region: "china" | "singapore" | "us"): string {
    const regionUrls = {
      china: "https://dashscope.aliyuncs.com/",
      singapore: "https://dashscope-intl.aliyuncs.com/",
      us: "https://dashscope-us.aliyuncs.com/",
    };
    return regionUrls[region];
  }

  constructor(
    fields: Partial<AlibabaTongyiChatInput> & BaseChatModelParams = {}
  ) {
    super(fields);

    this.alibabaApiKey =
      fields?.alibabaApiKey ?? getEnvironmentVariable("ALIBABA_API_KEY");
    if (!this.alibabaApiKey) {
      throw new Error("Ali API key not found");
    }

    // Set region (default to china)
    this.region = fields.region ?? "china";

    // Set API URL based on region
    this.apiUrl = `${this.getRegionBaseUrl(this.region)}api/v1/services/aigc/text-generation/generation`;

    this.lc_serializable = true;
    this.streaming = fields.streaming ?? false;
    this.prefixMessages = fields.prefixMessages ?? [];
    this.temperature = fields.temperature;
    this.topP = fields.topP;
    this.topK = fields.topK;
    this.seed = fields.seed;
    this.maxTokens = fields.maxTokens;
    this.repetitionPenalty = fields.repetitionPenalty;
    this.enableSearch = fields.enableSearch;
    this.modelName = fields?.model ?? fields.modelName ?? "qwen-turbo";
    this.model = this.modelName;
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): ChatCompletionRequest["parameters"] {
    const parameters: ChatCompletionRequest["parameters"] = {
      stream: this.streaming,
      temperature: this.temperature,
      top_p: this.topP,
      top_k: this.topK,
      seed: this.seed,
      max_tokens: this.maxTokens,
      result_format: "text",
      enable_search: this.enableSearch,
    };

    if (this.streaming) {
      parameters.incremental_output = true;
    } else {
      parameters.repetition_penalty = this.repetitionPenalty;
    }

    return parameters;
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams(): ChatCompletionRequest["parameters"] &
    Pick<ChatCompletionRequest, "model"> {
    return {
      model: this.model,
      ...this.invocationParams(),
    };
  }

  /** @ignore */
  async _generate(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const parameters = this.invocationParams();

    const messagesMapped: TongyiMessage[] = messages.map((message) => ({
      role: messageToTongyiRole(message),
      content: message.content as string,
    }));

    const data = parameters.stream
      ? await new Promise<ChatCompletionResponse>((resolve, reject) => {
          let response: ChatCompletionResponse;
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              model: this.model,
              parameters,
              input: {
                messages: messagesMapped,
              },
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

              const { text, finish_reason } = data.output;

              if (!response) {
                response = data;
              } else {
                response.output.text += text;
                response.output.finish_reason = finish_reason;
                response.usage = data.usage;
              }

              // eslint-disable-next-line no-void
              void runManager?.handleLLMNewToken(text ?? "");
              if (finish_reason && finish_reason !== "null") {
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
            model: this.model,
            parameters,
            input: {
              messages: messagesMapped,
            },
          },
          false,
          options?.signal
        ).then<ChatCompletionResponse>((data) => {
          if (data?.code) {
            throw new Error(data?.message);
          }

          return data;
        });

    const {
      input_tokens = 0,
      output_tokens = 0,
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
          promptTokens: input_tokens,
          completionTokens: output_tokens,
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
          Authorization: `Bearer ${this.alibabaApiKey}`,
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
              const event = new MessageEvent("message", {
                data: line.slice("data:".length).trim(),
              });
              onmessage?.(event);
            }
          }
        }
      }
    };

    return this.caller.call(makeCompletionRequest);
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const parameters = {
      ...this.invocationParams(),
      stream: true,
      incremental_output: true,
    };

    const messagesMapped: TongyiMessage[] = messages.map((message) => ({
      role: messageToTongyiRole(message),
      content: message.content as string,
    }));

    const stream = await this.caller.call(async () =>
      this.createTongyiStream(
        {
          model: this.model,
          parameters,
          input: {
            messages: messagesMapped,
          },
        },
        options?.signal
      )
    );

    for await (const chunk of stream) {
      /* if some error occurs:
         {
          "code": "DataInspectionFailed",
          "message": "Output data may contain inappropriate content.",
          "request_id": "43d18007-5aa5-9d18-b3b3-a55aba9ce8cb"
        }
      */
      if (!chunk.output && chunk.code) {
        throw new Error(JSON.stringify(chunk));
      }
      const { text, finish_reason } = chunk.output;
      yield new ChatGenerationChunk({
        text,
        message: new AIMessageChunk({ content: text }),
        generationInfo:
          finish_reason === "stop"
            ? {
                finish_reason,
                request_id: chunk.request_id,
                usage: chunk.usage,
              }
            : undefined,
      });
      await runManager?.handleLLMNewToken(text);
    }
  }

  private async *createTongyiStream(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.alibabaApiKey}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      let error;
      const responseText = await response.text();
      try {
        const json = JSON.parse(responseText);
        error = new Error(
          `Tongyi call failed with status code ${response.status}: ${json.error}`
        );
      } catch {
        error = new Error(
          `Tongyi call failed with status code ${response.status}: ${responseText}`
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }
    if (!response.body) {
      throw new Error(
        "Could not begin Tongyi stream. Please check the given URL and try again."
      );
    }
    const stream = IterableReadableStream.fromReadableStream(response.body);
    const decoder = new TextDecoder();
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
        } catch {
          console.warn(`Received a non-JSON parseable chunk: ${line}`);
        }
      }
    }
  }

  _llmType(): string {
    return "alibaba_tongyi";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
