import type { TiktokenModel } from "js-tiktoken/lite";
import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { calculateMaxTokens } from "../base_language/count_tokens.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { GenerationChunk, LLMResult } from "../schema/index.js";
import {
  AzureOpenAIInput,
  OpenAICallOptions,
  OpenAICoreRequestOptions,
  OpenAIInput,
  LegacyOpenAIInput,
} from "../types/openai-types.js";
import { OpenAIEndpointConfig, getEndpoint } from "../util/azure.js";
import { chunkArray } from "../util/chunk.js";
import { getEnvironmentVariable } from "../util/env.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";
import { BaseLLM, BaseLLMParams } from "./base.js";
import { OpenAIChat } from "./openai-chat.js";
import { wrapOpenAIClientError } from "../util/openai.js";

export { AzureOpenAIInput, OpenAICallOptions, OpenAIInput };

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
  static lc_name() {
    return "OpenAI";
  }

  get callKeys(): (keyof OpenAICallOptions)[] {
    return [...(super.callKeys as (keyof OpenAICallOptions)[]), "options"];
  }

  lc_serializable = true;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      azureOpenAIApiKey: "AZURE_OPENAI_API_KEY",
      organization: "OPENAI_ORGANIZATION",
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

  organization?: string;

  private client: OpenAIClient;

  private clientConfig: ClientOptions;

  constructor(
    fields?: Partial<OpenAIInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: ClientOptions & LegacyOpenAIInput;
      },
    /** @deprecated */
    configuration?: ClientOptions & LegacyOpenAIInput
  ) {
    if (
      (fields?.modelName?.startsWith("gpt-3.5-turbo") ||
        fields?.modelName?.startsWith("gpt-4") ||
        fields?.modelName?.startsWith("gpt-4-32k")) &&
      !fields?.modelName.endsWith("-instruct")
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

    this.organization =
      fields?.configuration?.organization ??
      getEnvironmentVariable("OPENAI_ORGANIZATION");

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
      this.openAIApiKey = this.openAIApiKey ?? "";
    }

    this.clientConfig = {
      apiKey: this.openAIApiKey,
      organization: this.organization,
      baseURL: configuration?.basePath ?? fields?.configuration?.basePath,
      dangerouslyAllowBrowser: true,
      defaultHeaders:
        configuration?.baseOptions?.headers ??
        fields?.configuration?.baseOptions?.headers,
      defaultQuery:
        configuration?.baseOptions?.params ??
        fields?.configuration?.baseOptions?.params,
      ...configuration,
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

  /** @ignore */
  _identifyingParams(): Omit<OpenAIClient.CompletionCreateParams, "prompt"> & {
    model_name: string;
  } & ClientOptions {
    return {
      model_name: this.modelName,
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
        modelName: this.modelName as TiktokenModel,
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
  private _getClientOptions(options: OpenAICoreRequestOptions | undefined) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        azureOpenAIApiDeploymentName: this.azureOpenAIApiDeploymentName,
        azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
        azureOpenAIApiKey: this.azureOpenAIApiKey,
        azureOpenAIBasePath: this.azureOpenAIBasePath,
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
    if (this.azureOpenAIApiKey) {
      requestOptions.headers = {
        "api-key": this.azureOpenAIApiKey,
        ...requestOptions.headers,
      };
      requestOptions.query = {
        "api-version": this.azureOpenAIApiVersion,
        ...requestOptions.query,
      };
    }
    return requestOptions;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...this._identifyingParams(), prompt: prompts[i] } as any,
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
