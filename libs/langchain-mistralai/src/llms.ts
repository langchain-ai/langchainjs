import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseLLMParams, LLM } from "@langchain/core/language_models/llms";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { GenerationChunk, LLMResult } from "@langchain/core/outputs";
import {
  ChatCompletionResponse,
  ChatCompletionResponseChoice,
  ChatCompletionResponseChunk,
  type CompletionRequest,
} from "@mistralai/mistralai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { AsyncCaller } from "@langchain/core/utils/async_caller";

export interface MistralAICallOptions extends BaseLanguageModelCallOptions {
  /**
   * Optional text/code that adds more context for the model.
   * When given a prompt and a suffix the model will fill what
   * is between them. When suffix is not provided, the model
   * will simply execute completion starting with prompt.
   */
  suffix?: string;
}

export interface MistralAIInput extends BaseLLMParams {
  /**
   * The name of the model to use.
   * @default "codestral-latest"
   */
  model?: string;
  /**
   * The API key to use.
   * @default {process.env.MISTRAL_API_KEY}
   */
  apiKey?: string;
  /**
   * Override the default endpoint.
   */
  endpoint?: string;
  /**
   * What sampling temperature to use, between 0.0 and 2.0.
   * Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
   * @default {0.7}
   */
  temperature?: number;
  /**
   * Nucleus sampling, where the model considers the results of the tokens with `topP` probability mass.
   * So 0.1 means only the tokens comprising the top 10% probability mass are considered.
   * Should be between 0 and 1.
   * @default {1}
   */
  topP?: number;
  /**
   * The maximum number of tokens to generate in the completion.
   * The token count of your prompt plus maxTokens cannot exceed the model's context length.
   */
  maxTokens?: number;
  /**
   * Whether or not to stream the response.
   * @default {false}
   */
  streaming?: boolean;
  /**
   * The seed to use for random sampling. If set, different calls will generate deterministic results.
   * Alias for `seed`
   */
  randomSeed?: number;
  /**
   * Batch size to use when passing multiple documents to generate
   */
  batchSize?: number;
}

/**
 * MistralAI completions LLM.
 */
export class MistralAI
  extends LLM<MistralAICallOptions>
  implements MistralAIInput
{
  static lc_name() {
    return "MistralAI";
  }

  model = "codestral-latest";

  temperature = 0;

  topP?: number;

  maxTokens?: number | undefined;

  randomSeed?: number | undefined;

  streaming = false;

  batchSize = 20;

  apiKey: string;

  endpoint?: string;

  maxRetries?: number;

  maxConcurrency?: number;

  constructor(fields?: MistralAIInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.randomSeed = fields?.randomSeed ?? this.randomSeed;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.streaming = fields?.streaming ?? this.streaming;
    this.endpoint = fields?.endpoint;
    this.maxRetries = fields?.maxRetries;
    this.maxConcurrency = fields?.maxConcurrency;

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("MISTRAL_API_KEY");
    if (!apiKey) {
      throw new Error(
        `MistralAI requires an API key to be set.
Either provide one via the "apiKey" field in the constructor, or set the "MISTRAL_API_KEY" environment variable.`
      );
    }
    this.apiKey = apiKey;
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "MISTRAL_API_KEY",
    };
  }

  _llmType() {
    return "mistralai";
  }

  invocationParams(
    options: this["ParsedCallOptions"]
  ): Omit<CompletionRequest, "prompt"> {
    return {
      model: this.model,
      suffix: options.suffix,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      topP: this.topP,
      randomSeed: this.randomSeed,
      stop: options.stop,
    };
  }

  /**
   * For some given input string and options, return a string output.
   *
   * Despite the fact that `invoke` is overridden below, we still need this
   * in order to handle public APi calls to `generate()`.
   */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const params = {
      ...this.invocationParams(options),
      prompt,
    };
    const result = await this.completionWithRetry(params, options, false);
    return result.choices[0].message.content ?? "";
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: ChatCompletionResponseChoice[][] = [];

    const params = this.invocationParams(options);

    for (let i = 0; i < subPrompts.length; i += 1) {
      const data = await (async () => {
        if (this.streaming) {
          const responseData: Array<
            { choices: ChatCompletionResponseChoice[] } & Partial<
              Omit<ChatCompletionResponse, "choices">
            >
          > = [];
          for (let x = 0; x < subPrompts[i].length; x += 1) {
            const choices: ChatCompletionResponseChoice[] = [];
            let response:
              | Omit<ChatCompletionResponse, "choices" | "usage">
              | undefined;
            const stream = await this.completionWithRetry(
              {
                ...params,
                prompt: subPrompts[i][x],
              },
              options,
              true
            );
            for await (const message of stream) {
              // on the first message set the response properties
              if (!response) {
                response = {
                  id: message.id,
                  object: "chat.completion",
                  created: message.created,
                  model: message.model,
                };
              }

              // on all messages, update choice
              for (const part of message.choices) {
                if (!choices[part.index]) {
                  choices[part.index] = {
                    index: part.index,
                    message: {
                      role: part.delta.role ?? "assistant",
                      content: part.delta.content ?? "",
                      tool_calls: null,
                    },
                    finish_reason: part.finish_reason,
                  };
                } else {
                  const choice = choices[part.index];
                  choice.message.content += part.delta.content ?? "";
                  choice.finish_reason = part.finish_reason;
                }
                void runManager?.handleLLMNewToken(part.delta.content ?? "", {
                  prompt: part.index,
                  completion: part.index,
                });
              }
            }
            if (options.signal?.aborted) {
              throw new Error("AbortError");
            }
            responseData.push({
              ...response,
              choices,
            });
          }
          return responseData;
        } else {
          const responseData: Array<ChatCompletionResponse> = [];
          for (let x = 0; x < subPrompts[i].length; x += 1) {
            const res = await this.completionWithRetry(
              {
                ...params,
                prompt: subPrompts[i][x],
              },
              options,
              false
            );
            responseData.push(res);
          }
          return responseData;
        }
      })();

      choices.push(...data.map((d) => d.choices));
    }

    const generations = choices.map((promptChoices) =>
      promptChoices.map((choice) => ({
        text: choice.message.content ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
        },
      }))
    );
    return {
      generations,
    };
  }

  async completionWithRetry(
    request: CompletionRequest,
    options: this["ParsedCallOptions"],
    stream: false
  ): Promise<ChatCompletionResponse>;

  async completionWithRetry(
    request: CompletionRequest,
    options: this["ParsedCallOptions"],
    stream: true
  ): Promise<AsyncGenerator<ChatCompletionResponseChunk, void>>;

  async completionWithRetry(
    request: CompletionRequest,
    options: this["ParsedCallOptions"],
    stream: boolean
  ): Promise<
    | ChatCompletionResponse
    | AsyncGenerator<ChatCompletionResponseChunk, void, unknown>
  > {
    const { MistralClient } = await this.imports();
    const caller = new AsyncCaller({
      maxConcurrency: options.maxConcurrency || this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const client = new MistralClient(
      this.apiKey,
      this.endpoint,
      this.maxRetries,
      options.timeout
    );
    return caller.callWithOptions(
      {
        signal: options.signal,
      },
      async () => {
        if (stream) {
          return client.completionStream(request);
        } else {
          return client.completion(request);
        }
      }
    );
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const params = {
      ...this.invocationParams(options),
      prompt,
    };
    const stream = await this.completionWithRetry(params, options, true);
    for await (const data of stream) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const chunk = new GenerationChunk({
        text: choice.delta.content ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
          tokenUsage: data.usage,
        },
      });
      yield chunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  /** @ignore */
  private async imports() {
    const { default: MistralClient } = await import("@mistralai/mistralai");
    return { MistralClient };
  }
}
