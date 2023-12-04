import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { type BaseLLMParams, LLM } from "@langchain/core/language_models/llms";
import {
  AzureOpenAIInput,
  OpenAICallOptions,
  OpenAIChatInput,
  OpenAICoreRequestOptions,
  LegacyOpenAIInput,
} from "./types.js";
import { OpenAIEndpointConfig, getEndpoint } from "./utils/azure.js";
import { wrapOpenAIClientError } from "./utils/openai.js";

export { type AzureOpenAIInput, type OpenAIChatInput };
/**
 * Interface that extends the OpenAICallOptions interface and includes an
 * optional promptIndex property. It represents the options that can be
 * passed when making a call to the OpenAI Chat API.
 */
export interface OpenAIChatCallOptions extends OpenAICallOptions {
  promptIndex?: number;
}

/**
 * Wrapper around OpenAI large language models that use the Chat endpoint.
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
 * https://platform.openai.com/docs/api-reference/chat/create |
 * `openai.createCompletion`} can be passed through {@link modelKwargs}, even
 * if not explicitly available on this class.
 *
 * @augments BaseLLM
 * @augments OpenAIInput
 * @augments AzureOpenAIChatInput
 * @example
 * ```typescript
 * const model = new OpenAIChat({
 *   prefixMessages: [
 *     {
 *       role: "system",
 *       content: "You are a helpful assistant that answers in pirate language",
 *     },
 *   ],
 *   maxTokens: 50,
 * });
 *
 * const res = await model.call(
 *   "What would be a good company name for a company that makes colorful socks?"
 * );
 * console.log({ res });
 * ```
 */
export class OpenAIChat
  extends LLM<OpenAIChatCallOptions>
  implements OpenAIChatInput, AzureOpenAIInput
{
  static lc_name() {
    return "OpenAIChat";
  }

  get callKeys() {
    return [...super.callKeys, "options", "promptIndex"];
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

  temperature = 1;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  logitBias?: Record<string, number>;

  maxTokens?: number;

  modelName = "gpt-3.5-turbo";

  prefixMessages?: OpenAIClient.Chat.ChatCompletionMessageParam[];

  modelKwargs?: OpenAIChatInput["modelKwargs"];

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
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: ClientOptions & LegacyOpenAIInput;
      },
    /** @deprecated */
    configuration?: ClientOptions & LegacyOpenAIInput
  ) {
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
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.timeout = fields?.timeout;

    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.n = fields?.n ?? this.n;
    this.logitBias = fields?.logitBias;
    this.maxTokens = fields?.maxTokens;
    this.stop = fields?.stop;
    this.user = fields?.user;

    this.streaming = fields?.streaming ?? false;

    if (this.n > 1) {
      throw new Error(
        "Cannot use n > 1 in OpenAIChat LLM. Use ChatOpenAI Chat Model instead."
      );
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
  ): Omit<OpenAIClient.Chat.ChatCompletionCreateParams, "messages"> {
    return {
      model: this.modelName,
      temperature: this.temperature,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      n: this.n,
      logit_bias: this.logitBias,
      max_tokens: this.maxTokens === -1 ? undefined : this.maxTokens,
      stop: options?.stop ?? this.stop,
      user: this.user,
      stream: this.streaming,
      ...this.modelKwargs,
    };
  }

  /** @ignore */
  _identifyingParams(): Omit<
    OpenAIClient.Chat.ChatCompletionCreateParams,
    "messages"
  > & {
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
  identifyingParams(): Omit<
    OpenAIClient.Chat.ChatCompletionCreateParams,
    "messages"
  > & {
    model_name: string;
  } & ClientOptions {
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  /**
   * Formats the messages for the OpenAI API.
   * @param prompt The prompt to be formatted.
   * @returns Array of formatted messages.
   */
  private formatMessages(
    prompt: string
  ): OpenAIClient.Chat.ChatCompletionMessageParam[] {
    const message: OpenAIClient.Chat.ChatCompletionMessageParam = {
      role: "user",
      content: prompt,
    };
    return this.prefixMessages ? [...this.prefixMessages, message] : [message];
  }

  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const params = {
      ...this.invocationParams(options),
      messages: this.formatMessages(prompt),
      stream: true as const,
    };
    const stream = await this.completionWithRetry(params, options);
    for await (const data of stream) {
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      const { delta } = choice;
      const generationChunk = new GenerationChunk({
        text: delta.content ?? "",
      });
      yield generationChunk;
      const newTokenIndices = {
        prompt: options.promptIndex ?? 0,
        completion: choice.index ?? 0,
      };
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(
        generationChunk.text ?? "",
        newTokenIndices
      );
    }
    if (options.signal?.aborted) {
      throw new Error("AbortError");
    }
  }

  /** @ignore */
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const params = this.invocationParams(options);

    if (params.stream) {
      const stream = await this._streamResponseChunks(
        prompt,
        options,
        runManager
      );
      let finalChunk: GenerationChunk | undefined;
      for await (const chunk of stream) {
        if (finalChunk === undefined) {
          finalChunk = chunk;
        } else {
          finalChunk = finalChunk.concat(chunk);
        }
      }
      return finalChunk?.text ?? "";
    } else {
      const response = await this.completionWithRetry(
        {
          ...params,
          stream: false,
          messages: this.formatMessages(prompt),
        },
        {
          signal: options.signal,
          ...options.options,
        }
      );
      return response?.choices[0]?.message?.content ?? "";
    }
  }

  /**
   * Calls the OpenAI API with retry logic in case of failures.
   * @param request The request to send to the OpenAI API.
   * @param options Optional configuration for the API call.
   * @returns The response from the OpenAI API.
   */
  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>>;

  async completionWithRetry(
    request: OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<OpenAIClient.Chat.Completions.ChatCompletion>;

  async completionWithRetry(
    request:
      | OpenAIClient.Chat.ChatCompletionCreateParamsStreaming
      | OpenAIClient.Chat.ChatCompletionCreateParamsNonStreaming,
    options?: OpenAICoreRequestOptions
  ): Promise<
    | AsyncIterable<OpenAIClient.Chat.Completions.ChatCompletionChunk>
    | OpenAIClient.Chat.Completions.ChatCompletion
  > {
    const requestOptions = this._getClientOptions(options);
    return this.caller.call(async () => {
      try {
        const res = await this.client.chat.completions.create(
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

  /** @ignore */
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
