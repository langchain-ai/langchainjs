import type { TiktokenModel } from "js-tiktoken/lite";
import {
  Configuration,
  ConfigurationParameters,
  CreateCompletionRequest,
  CreateCompletionResponse,
  CreateCompletionResponseChoicesInner,
  OpenAIApi,
} from "openai";
import { isNode, getEnvironmentVariable } from "../util/env.js";
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
import { LLMResult, GenerationChunk } from "../schema/index.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";
import { getEndpoint, OpenAIEndpointConfig } from "../util/azure.js";
import { readableStreamToAsyncIterable } from "../util/stream.js";

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
export class OpenAI
  extends BaseLLM<OpenAICallOptions>
  implements OpenAIInput, AzureOpenAIInput
{
  get callKeys(): (keyof OpenAICallOptions)[] {
    return [...(super.callKeys as (keyof OpenAICallOptions)[]), "options"];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      modelName: "model",
      openAIApiKey: "openai_api_key",
      azureOpenAIApiVersion: "azure_openai_api_version",
      azureOpenAIApiKey: "azure_openai_api_key",
      azureOpenAIApiInstanceName: "azure_openai_api_instance_name",
      azureOpenAIApiDeploymentName: "azure_openai_api_deployment_name",
    };
  }

  temperature = 0.7;

  maxTokens = 256;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  bestOf?: number;

  logitBias?: Record<string, number>;

  modelName = "text-davinci-003";

  modelKwargs?: OpenAIInput["modelKwargs"];

  batchSize = 20;

  timeout?: number;

  stop?: string[];

  user?: string;

  streaming = false;

  openAIApiKey?: string;

  azureOpenAIApiVersion?: string;

  azureOpenAIApiKey?: string;

  azureOpenAIApiInstanceName?: string;

  azureOpenAIApiDeploymentName?: string;

  azureOpenAIBasePath?: string;

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: ConfigurationParameters;
      },
    /** @deprecated */
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

    this.openAIApiKey =
      fields?.openAIApiKey ?? getEnvironmentVariable("OPENAI_API_KEY");

    this.azureOpenAIApiKey =
      fields?.azureOpenAIApiKey ??
      getEnvironmentVariable("AZURE_OPENAI_API_KEY");

    if (!this.azureOpenAIApiKey && !this.openAIApiKey) {
      throw new Error("OpenAI or Azure OpenAI API key not found");
    }

    this.azureOpenAIApiInstanceName =
      fields?.azureOpenAIApiInstanceName ??
      getEnvironmentVariable("AZURE_OPENAI_API_INSTANCE_NAME");

    this.azureOpenAIApiDeploymentName =
      (fields?.azureOpenAIApiCompletionsDeploymentName ||
        fields?.azureOpenAIApiDeploymentName) ??
      (getEnvironmentVariable("AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME") ||
        getEnvironmentVariable("AZURE_OPENAI_API_DEPLOYMENT_NAME"));

    this.azureOpenAIApiVersion =
      fields?.azureOpenAIApiVersion ??
      getEnvironmentVariable("AZURE_OPENAI_API_VERSION");

    this.azureOpenAIBasePath =
      fields?.azureOpenAIBasePath ??
      getEnvironmentVariable("AZURE_OPENAI_BASE_PATH");

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
    this.user = fields?.user;

    this.streaming = fields?.streaming ?? false;

    if (this.streaming && this.bestOf && this.bestOf > 1) {
      throw new Error("Cannot stream results when bestOf > 1");
    }

    if (this.azureOpenAIApiKey) {
      if (!this.azureOpenAIApiInstanceName && !this.azureOpenAIBasePath) {
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
      apiKey: this.openAIApiKey,
      ...configuration,
      ...fields?.configuration,
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(
    options?: this["ParsedCallOptions"]
  ): CreateCompletionRequest {
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
      stop: options?.stop ?? this.stop,
      user: this.user,
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
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: CreateCompletionResponseChoicesInner[] = [];
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
                    if (resolved || rejected) {
                      return;
                    }
                    resolved = true;
                    resolve({
                      ...response,
                      choices,
                    });
                  } else {
                    const data = JSON.parse(event.data);

                    if (data?.error) {
                      if (rejected) {
                        return;
                      }
                      rejected = true;
                      reject(data.error);
                      return;
                    }

                    const message = data as Omit<
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
                        // eslint-disable-next-line no-void
                        void runManager?.handleLLMNewToken(part.text ?? "", {
                          prompt: Math.floor(part.index / this.n),
                          completion: part.index % this.n,
                        });
                      }
                    }

                    // when all messages are finished, resolve
                    if (
                      !resolved &&
                      !rejected &&
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

  // TODO(jacoblee): Refactor with _generate(..., {stream: true}) implementation
  // when we integrate OpenAI's new SDK.
  async *_streamResponseChunks(
    input: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const params = {
      ...this.invocationParams(options),
      prompt: input,
      stream: true,
    };
    const streamIterable = this.startStream(params, options);
    for await (const streamedResponse of streamIterable) {
      const data = JSON.parse(streamedResponse);
      const choice = data.choices?.[0];
      if (!choice) {
        continue;
      }
      const chunk = new GenerationChunk({
        text: choice.text,
        generationInfo: {
          finishReason: choice.finish_reason,
          logprobs: choice.logprobs,
        },
      });
      yield chunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(chunk.text ?? "");
    }
  }

  startStream(
    request: CreateCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    let done = false;
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const iterable = readableStreamToAsyncIterable(stream.readable);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let err: any;
    this.completionWithRetry(request, {
      ...options,
      adapter: fetchAdapter, // default adapter doesn't do streaming
      responseType: "stream",
      onmessage: (event) => {
        if (done) return;
        if (event.data?.trim?.() === "[DONE]") {
          done = true;
          // eslint-disable-next-line no-void
          void writer.close();
        } else {
          const data = JSON.parse(event.data);
          if (data.error) {
            done = true;
            throw data.error;
          }
          // eslint-disable-next-line no-void
          void writer.write(event.data);
        }
      },
    }).catch((error) => {
      if (!done) {
        err = error;
        done = true;
        // eslint-disable-next-line no-void
        void writer.close();
      }
    });
    return {
      async next() {
        const chunk = await iterable.next();
        if (err) {
          throw err;
        }
        return chunk;
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  /** @ignore */
  async completionWithRetry(
    request: CreateCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        azureOpenAIApiDeploymentName: this.azureOpenAIApiDeploymentName,
        azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
        azureOpenAIApiKey: this.azureOpenAIApiKey,
        azureOpenAIBasePath: this.azureOpenAIBasePath,
        basePath: this.clientConfig.basePath,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

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
      adapter: isNode() ? undefined : fetchAdapter,
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
  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      promptLayerApiKey: "PROMPTLAYER_API_KEY",
    };
  }

  lc_serializable = false;

  promptLayerApiKey?: string;

  plTags?: string[];

  returnPromptLayerId?: boolean;

  constructor(
    fields?: ConstructorParameters<typeof OpenAI>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
      returnPromptLayerId?: boolean;
    }
  ) {
    super(fields);

    this.plTags = fields?.plTags ?? [];
    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      getEnvironmentVariable("PROMPTLAYER_API_KEY");

    this.returnPromptLayerId = fields?.returnPromptLayerId;
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

    const response = await super.completionWithRetry(request);

    return response;
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const requestStartTime = Date.now();
    const generations = await super._generate(prompts, options, runManager);

    for (let i = 0; i < generations.generations.length; i += 1) {
      const requestEndTime = Date.now();
      const parsedResp = {
        text: generations.generations[i][0].text,
        llm_output: generations.llmOutput,
      };

      const promptLayerRespBody = await promptLayerTrackRequest(
        this.caller,
        "langchain.PromptLayerOpenAI",
        [prompts[i]],
        this._identifyingParams(),
        this.plTags,
        parsedResp,
        requestStartTime,
        requestEndTime,
        this.promptLayerApiKey
      );

      let promptLayerRequestId;
      if (this.returnPromptLayerId === true) {
        if (promptLayerRespBody && promptLayerRespBody.success === true) {
          promptLayerRequestId = promptLayerRespBody.request_id;
        }

        generations.generations[i][0].generationInfo = {
          ...generations.generations[i][0].generationInfo,
          promptLayerRequestId,
        };
      }
    }

    return generations;
  }
}

export { OpenAIChat, PromptLayerOpenAIChat } from "./openai-chat.js";
