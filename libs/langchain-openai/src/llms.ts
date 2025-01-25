import type { TiktokenModel } from "js-tiktoken/lite";
import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { calculateMaxTokens } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk, type LLMResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  BaseLLM,
  type BaseLLMParams,
} from "@langchain/core/language_models/llms";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import type {
  OpenAICallOptions,
  OpenAICoreRequestOptions,
  OpenAIInput,
} from "./types.js";
import { OpenAIEndpointConfig, getEndpoint } from "./utils/azure.js";
import { wrapOpenAIClientError } from "./utils/openai.js";

export type { OpenAICallOptions, OpenAIInput };

/**
 * Interface for tracking token usage in OpenAI calls.
 */
interface TokenUsage {
  completionTokens?: number;
  promptTokens?: number;
  totalTokens?: number;
}

/**
 * Wrapper around OpenAI large language models.
 *
 * To use you should have the `openai` package installed, with the
 * `OPENAI_API_KEY` environment variable set.
 *
 * To use with Azure, import the `AzureOpenAI` class.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://platform.openai.com/docs/api-reference/completions/create |
 * `openai.createCompletion`} can be passed through {@link modelKwargs}, even
 * if not explicitly available on this class.
 * @example
 * ```typescript
 * const model = new OpenAI({
 *   modelName: "gpt-4",
 *   temperature: 0.7,
 *   maxTokens: 1000,
 *   maxRetries: 5,
 * });
 *
 * const res = await model.invoke(
 *   "Question: What would be a good company name for a company that makes colorful socks?\nAnswer:"
 * );
 * console.log({ res });
 * ```
 */
export class OpenAI<CallOptions extends OpenAICallOptions = OpenAICallOptions>
  extends BaseLLM<CallOptions>
  implements Partial<OpenAIInput>
{
  static lc_name() {
    return "OpenAI";
  }

  get callKeys() {
    return [...super.callKeys, "options"];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      apiKey: "OPENAI_API_KEY",
      organization: "OPENAI_ORGANIZATION",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
      openAIApiKey: "openai_api_key",
      apiKey: "openai_api_key",
    };
  }

  temperature?: number;

  maxTokens?: number;

  topP?: number;

  frequencyPenalty?: number;

  presencePenalty?: number;

  n = 1;

  bestOf?: number;

  logitBias?: Record<string, number>;

  model = "gpt-3.5-turbo-instruct";

  /** @deprecated Use "model" instead */
  modelName: string;

  modelKwargs?: OpenAIInput["modelKwargs"];

  batchSize = 20;

  timeout?: number;

  stop?: string[];

  stopSequences?: string[];

  user?: string;

  streaming = false;

  openAIApiKey?: string;

  apiKey?: string;

  organization?: string;

  protected client: OpenAIClient;

  protected clientConfig: ClientOptions;

  constructor(
    fields?: Partial<OpenAIInput> &
      BaseLLMParams & {
        configuration?: ClientOptions;
      }
  ) {
    super(fields ?? {});

    this.openAIApiKey =
      fields?.apiKey ??
      fields?.openAIApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");
    this.apiKey = this.openAIApiKey;

    this.organization =
      fields?.configuration?.organization ??
      getEnvironmentVariable("OPENAI_ORGANIZATION");

    this.model = fields?.model ?? fields?.modelName ?? this.model;
    if (
      (this.model?.startsWith("gpt-3.5-turbo") ||
        this.model?.startsWith("gpt-4") ||
        this.model?.startsWith("o1")) &&
      !this.model?.includes("-instruct")
    ) {
      throw new Error(
        [
          `Your chosen OpenAI model, "${this.model}", is a chat model and not a text-in/text-out LLM.`,
          `Passing it into the "OpenAI" class is no longer supported.`,
          `Please use the "ChatOpenAI" class instead.`,
          "",
          `See this page for more information:`,
          "|",
          `└> https://js.langchain.com/docs/integrations/chat/openai`,
        ].join("\n")
      );
    }
    this.modelName = this.model;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.timeout = fields?.timeout;

    this.temperature = fields?.temperature ?? this.temperature;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.n = fields?.n ?? this.n;
    this.bestOf = fields?.bestOf ?? this.bestOf;
    this.logitBias = fields?.logitBias;
    this.stop = fields?.stopSequences ?? fields?.stop;
    this.stopSequences = fields?.stopSequences;
    this.user = fields?.user;

    this.streaming = fields?.streaming ?? false;

    if (this.streaming && this.bestOf && this.bestOf > 1) {
      throw new Error("Cannot stream results when bestOf > 1");
    }

    this.clientConfig = {
      apiKey: this.apiKey,
      organization: this.organization,
      dangerouslyAllowBrowser: true,
      ...fields?.configuration,
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): Omit<OpenAIClient.CompletionCreateParams, "prompt"> {
    return {
      model: this.model,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      n: this.n,
      best_of: this.bestOf,
      logit_bias: this.logitBias,
      stop: options?.stop ?? this.stopSequences,
      user: this.user,
      stream: this.streaming,
      ...this.modelKwargs,
    };
  }

  /** @ignore */
  _identifyingParams(): Omit<OpenAIClient.CompletionCreateParams, "prompt"> & {
    model_name: string;
  } & ClientOptions {
    return {
      model_name: this.model,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams(): Omit<OpenAIClient.CompletionCreateParams, "prompt"> & {
    model_name: string;
  } & ClientOptions {
    return this._identifyingParams();
  }

  /**
   * Call out to OpenAI's endpoint with k unique prompts
   *
   * @param [prompts] - The prompts to pass into the model.
   * @param [options] - Optional list of stop words to use when generating.
   * @param [runManager] - Optional callback manager to use when generating.
   *
   * @returns The full LLM output.
   *
   * @example
   * ```ts
   * import { OpenAI } from "langchain/llms/openai";
   * const openai = new OpenAI();
   * const response = await openai.generate(["Tell me a joke."]);
   * ```
   */
  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: OpenAIClient.CompletionChoice[] = [];
    const tokenUsage: TokenUsage = {};

    const params = this.invocationParams(options);

    if (params.max_tokens === -1) {
      if (prompts.length !== 1) {
        throw new Error(
          "max_tokens set to -1 not supported for multiple inputs"
        );
      }
      params.max_tokens = await calculateMaxTokens({
        prompt: prompts[0],
        // Cast here to allow for other models that may not fit the union
        modelName: this.model as TiktokenModel,
      });
    }

    for (let i = 0; i < subPrompts.length; i += 1) {
      const data = params.stream
        ? await (async () => {
            const choices: OpenAIClient.CompletionChoice[] = [];
            let response: Omit<OpenAIClient.Completion, "choices"> | undefined;
            const stream = await this.completionWithRetry(
              {
                ...params,
                stream: true,
                prompt: subPrompts[i],
              },
              options
            );
            for await (const message of stream) {
              // on the first message set the response properties
              if (!response) {
                response = {
                  id: message.id,
                  object: message.object,
                  created: message.created,
                  model: message.model,
                };
              }

              // on all messages, update choice
              for (const part of message.choices) {
                if (!choices[part.index]) {
                  choices[part.index] = part;
                } else {
                  const choice = choices[part.index];
                  choice.text += part.text;
                  choice.finish_reason = part.finish_reason;
                  choice.logprobs = part.logprobs;
                }
                void runManager?.handleLLMNewToken(part.text, {
                  prompt: Math.floor(part.index / this.n),
                  completion: part.index % this.n,
                });
              }
            }
            if (options.signal?.aborted) {
              throw new Error("AbortError");
            }
            return { ...response, choices };
          })()
        : await this.completionWithRetry(
            {
              ...params,
              stream: false,
              prompt: subPrompts[i],
            },
            {
              signal: options.signal,
              ...options.options,
            }
          );

      choices.push(...data.choices);
      const {
        completion_tokens: completionTokens,
        prompt_tokens: promptTokens,
        total_tokens: totalTokens,
      } = data.usage
        ? data.usage
        : {
            completion_tokens: undefined,
            prompt_tokens: undefined,
            total_tokens: undefined,
          };

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
    }

    const generations = chunkArray(choices, this.n).map((promptChoices) =>
      promptChoices.map((choice) => ({
        text: choice.text ?? "",
        generationInfo: {
          finishReason: choice.finish_reason,
          logprobs: choice.logprobs,
        },
      }))
    );
    return {
      generations,
      llmOutput: { tokenUsage },
    };
  }

  // TODO(jacoblee): Refactor with _generate(..., {stream: true}) implementation?
  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const params = {
      ...this.invocationParams(options),
      prompt: input,
      stream: true as const,
    };
    const stream = await this.completionWithRetry(params, options);
    for await (const data of stream) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const chunk = new GenerationChunk({
        text: choice.text,
        generationInfo: {
          finishReason: choice.finish_reason,
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

  /**
   * Calls the OpenAI API with retry logic in case of failures.
   * @param request The request to send to the OpenAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the OpenAI API.
   */
  async completionWithRetry(
    request: OpenAIClient.CompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Completion>>;

  async completionWithRetry(
    request: OpenAIClient.CompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<OpenAIClient.Completions.Completion>;

  async completionWithRetry(
    request:
      | OpenAIClient.CompletionCreateParamsStreaming
      | OpenAIClient.CompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    AsyncIterable<OpenAIClient.Completion> | OpenAIClient.Completions.Completion
  > {
    const requestOptions = this._getClientOptions(options);
    return this.caller.call(async () => {
      try {
        const res = await this.client.completions.create(
          request,
          requestOptions
        );
        return res;
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /**
   * Calls the OpenAI API with retry logic in case of failures.
   * @param request The request to send to the OpenAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the OpenAI API.
   */
  protected _getClientOptions(options: OpenAICoreRequestOptions | undefined) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        baseURL: this.clientConfig.baseURL,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

      const params = {
        ...this.clientConfig,
        baseURL: endpoint,
        timeout: this.timeout,
        maxRetries: 0,
      };

      if (!params.baseURL) {
        delete params.baseURL;
      }

      this.client = new OpenAIClient(params);
    }
    const requestOptions = {
      ...this.clientConfig,
      ...options,
    } as OpenAICoreRequestOptions;
    return requestOptions;
  }

  _llmType() {
    return "openai";
  }
}
