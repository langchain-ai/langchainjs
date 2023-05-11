import { TiktokenModel } from "@dqbd/tiktoken";
import { isNode } from "browser-or-node";
import {
  Configuration,
  ConfigurationParameters,
  CreateCompletionRequest,
  CreateCompletionResponse,
  CreateCompletionResponseChoicesInner,
  OpenAIApi,
} from "openai";
import {
  AzureOpenAIInput,
  OpenAICallOptions,
  OpenAIInput,
} from "../types/openai-types.js";
import type { StreamingAxiosConfiguration } from "../util/axios-types.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { chunkArray } from "../util/chunk.js";
import { BaseLLM, BaseLLMParams } from "./base.js";
import { calculateMaxTokens } from "../base_language/count_tokens.js";
import { OpenAIChat } from "./openai-chat.js";
import { LLMResult } from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";

export { OpenAICallOptions, AzureOpenAIInput, OpenAIInput };

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
 * To use with Azure you should have the `openai` package installed, with the
 * `AZURE_OPENAI_API_KEY`,
 * `AZURE_OPENAI_API_INSTANCE_NAME`,
 * `AZURE_OPENAI_API_DEPLOYMENT_NAME`
 * and `AZURE_OPENAI_API_VERSION` environment variable set.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://platform.openai.com/docs/api-reference/completions/create |
 * `openai.createCompletion`} can be passed through {@link modelKwargs}, even
 * if not explicitly available on this class.
 */
export class OpenAI extends BaseLLM implements OpenAIInput, AzureOpenAIInput {
  declare CallOptions: OpenAICallOptions;

  get callKeys(): (keyof OpenAICallOptions)[] {
    return ["stop", "signal", "timeout", "options"];
  }

  temperature = 0.7;

  maxTokens = 256;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  bestOf = 1;

  logitBias?: Record<string, number>;

  modelName = "text-davinci-003";

  modelKwargs?: OpenAIInput["modelKwargs"];

  batchSize = 20;

  timeout?: number;

  stop?: string[];

  streaming = false;

  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        openAIApiKey?: string;
      },
    configuration?: ConfigurationParameters
  ) {
    if (
      fields?.modelName?.startsWith("gpt-3.5-turbo") ||
      fields?.modelName?.startsWith("gpt-4") ||
      fields?.modelName?.startsWith("gpt-4-32k")
    ) {
      // eslint-disable-next-line no-constructor-return, @typescript-eslint/no-explicit-any
      return new OpenAIChat(fields, configuration) as any as OpenAI;
    }
    super(fields ?? {});

    const apiKey =
      fields?.openAIApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.OPENAI_API_KEY
        : undefined);

    const azureApiKey =
      fields?.azureOpenAIApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_KEY
        : undefined);
    if (!azureApiKey && !apiKey) {
      throw new Error("(Azure) OpenAI API key not found");
    }

    const azureApiInstanceName =
      fields?.azureOpenAIApiInstanceName ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_INSTANCE_NAME
        : undefined);

    const azureApiDeploymentName =
      (fields?.azureOpenAIApiCompletionsDeploymentName ||
        fields?.azureOpenAIApiDeploymentName) ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME ||
          // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_DEPLOYMENT_NAME
        : undefined);

    const azureApiVersion =
      fields?.azureOpenAIApiVersion ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.AZURE_OPENAI_API_VERSION
        : undefined);

    this.modelName = fields?.modelName ?? this.modelName;
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
    this.stop = fields?.stop;

    this.streaming = fields?.streaming ?? false;

    this.azureOpenAIApiVersion = azureApiVersion;
    this.azureOpenAIApiKey = azureApiKey;
    this.azureOpenAIApiInstanceName = azureApiInstanceName;
    this.azureOpenAIApiDeploymentName = azureApiDeploymentName;

    if (this.streaming && this.n > 1) {
      throw new Error("Cannot stream results when n > 1");
    }

    if (this.streaming && this.bestOf > 1) {
      throw new Error("Cannot stream results when bestOf > 1");
    }

    if (this.azureOpenAIApiKey) {
      if (!this.azureOpenAIApiInstanceName) {
        throw new Error("Azure OpenAI API instance name not found");
      }
      if (!this.azureOpenAIApiDeploymentName) {
        throw new Error("Azure OpenAI API deployment name not found");
      }
      if (!this.azureOpenAIApiVersion) {
        throw new Error("Azure OpenAI API version not found");
      }
    }

    this.clientConfig = {
      apiKey,
      ...configuration,
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): CreateCompletionRequest {
    return {
      model: this.modelName,
      temperature: this.temperature,
      max_tokens: this.maxTokens,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      n: this.n,
      best_of: this.bestOf,
      logit_bias: this.logitBias,
      stop: this.stop,
      stream: this.streaming,
      ...this.modelKwargs,
    };
  }

  _identifyingParams() {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
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
    const { stop } = options;
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: CreateCompletionResponseChoicesInner[] = [];
    const tokenUsage: TokenUsage = {};

    if (this.stop && stop) {
      throw new Error("Stop found in input and default params");
    }

    const params = this.invocationParams();
    params.stop = stop ?? params.stop;

    if (params.max_tokens === -1) {
      if (prompts.length !== 1) {
        throw new Error(
          "max_tokens set to -1 not supported for multiple inputs"
        );
      }
      params.max_tokens = await calculateMaxTokens({
        prompt: prompts[0],
        // Cast here to allow for other models that may not fit the union
        modelName: this.modelName as TiktokenModel,
      });
    }

    for (let i = 0; i < subPrompts.length; i += 1) {
      const data = params.stream
        ? await new Promise<CreateCompletionResponse>((resolve, reject) => {
            const choices: CreateCompletionResponseChoicesInner[] = [];
            let response: Omit<CreateCompletionResponse, "choices">;
            let rejected = false;
            let resolved = false;
            this.completionWithRetry(
              {
                ...params,
                prompt: subPrompts[i],
              },
              {
                signal: options.signal,
                ...options.options,
                adapter: fetchAdapter, // default adapter doesn't do streaming
                responseType: "stream",
                onmessage: (event) => {
                  if (event.data?.trim?.() === "[DONE]") {
                    if (resolved) {
                      return;
                    }
                    resolved = true;
                    resolve({
                      ...response,
                      choices,
                    });
                  } else {
                    const message = JSON.parse(event.data) as Omit<
                      CreateCompletionResponse,
                      "usage"
                    >;

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
                      if (part != null && part.index != null) {
                        if (!choices[part.index]) choices[part.index] = {};
                        const choice = choices[part.index];
                        choice.text = (choice.text ?? "") + (part.text ?? "");
                        choice.finish_reason = part.finish_reason;
                        choice.logprobs = part.logprobs;
                        // TODO this should pass part.index to the callback
                        // when that's supported there
                        // eslint-disable-next-line no-void
                        void runManager?.handleLLMNewToken(part.text ?? "");
                      }
                    }

                    // when all messages are finished, resolve
                    if (
                      !resolved &&
                      choices.every((c) => c.finish_reason != null)
                    ) {
                      resolved = true;
                      resolve({
                        ...response,
                        choices,
                      });
                    }
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

  /** @ignore */
  async completionWithRetry(
    request: CreateCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    if (!this.client) {
      const endpoint = this.azureOpenAIApiKey
        ? `https://${this.azureOpenAIApiInstanceName}.openai.azure.com/openai/deployments/${this.azureOpenAIApiDeploymentName}`
        : this.clientConfig.basePath;
      const clientConfig = new Configuration({
        ...this.clientConfig,
        basePath: endpoint,
        baseOptions: {
          timeout: this.timeout,
          ...this.clientConfig.baseOptions,
        },
      });
      this.client = new OpenAIApi(clientConfig);
    }
    const axiosOptions: StreamingAxiosConfiguration = {
      adapter: isNode ? undefined : fetchAdapter,
      ...this.clientConfig.baseOptions,
      ...options,
    };
    if (this.azureOpenAIApiKey) {
      axiosOptions.headers = {
        "api-key": this.azureOpenAIApiKey,
        ...axiosOptions.headers,
      };
      axiosOptions.params = {
        "api-version": this.azureOpenAIApiVersion,
        ...axiosOptions.params,
      };
    }
    return this.caller
      .call(
        this.client.createCompletion.bind(this.client),
        request,
        axiosOptions
      )
      .then((res) => res.data);
  }

  _llmType() {
    return "openai";
  }
}

/**
 * PromptLayer wrapper to OpenAI
 * @augments OpenAI
 */
export class PromptLayerOpenAI extends OpenAI {
  promptLayerApiKey?: string;

  plTags?: string[];

  constructor(
    fields?: ConstructorParameters<typeof OpenAI>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
    }
  ) {
    super(fields);

    this.plTags = fields?.plTags ?? [];
    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.PROMPTLAYER_API_KEY
        : undefined);

    if (!this.promptLayerApiKey) {
      throw new Error("Missing PromptLayer API key");
    }
  }

  async completionWithRetry(
    request: CreateCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    if (request.stream) {
      return super.completionWithRetry(request, options);
    }

    const requestStartTime = Date.now();
    const response = await super.completionWithRetry(request);
    const requestEndTime = Date.now();

    // https://github.com/MagnivOrg/promptlayer-js-helper
    await this.caller.call(fetch, "https://api.promptlayer.com/track-request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        function_name: "openai.Completion.create",
        args: [],
        kwargs: { engine: request.model, prompt: request.prompt },
        tags: this.plTags ?? [],
        request_response: response,
        request_start_time: Math.floor(requestStartTime / 1000),
        request_end_time: Math.floor(requestEndTime / 1000),
        api_key: this.promptLayerApiKey,
      }),
    });

    return response;
  }
}

export { OpenAIChat, PromptLayerOpenAIChat } from "./openai-chat.js";
