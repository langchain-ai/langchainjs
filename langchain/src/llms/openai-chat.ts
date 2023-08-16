import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  ConfigurationParameters,
  ChatCompletionResponseMessageRoleEnum,
  CreateChatCompletionResponse,
} from "openai";
import { isNode, getEnvironmentVariable } from "../util/env.js";
import {
  AzureOpenAIInput,
  OpenAICallOptions,
  OpenAIChatInput,
} from "../types/openai-types.js";
import type { StreamingAxiosConfiguration } from "../util/axios-types.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { BaseLLMParams, LLM } from "./base.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";
import { Generation, LLMResult, GenerationChunk } from "../schema/index.js";
import { promptLayerTrackRequest } from "../util/prompt-layer.js";
import { getEndpoint, OpenAIEndpointConfig } from "../util/azure.js";
import { readableStreamToAsyncIterable } from "../util/stream.js";

export { OpenAIChatInput, AzureOpenAIInput };

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
 */
export class OpenAIChat
  extends LLM<OpenAIChatCallOptions>
  implements OpenAIChatInput, AzureOpenAIInput
{
  get callKeys(): (keyof OpenAIChatCallOptions)[] {
    return [
      ...(super.callKeys as (keyof OpenAIChatCallOptions)[]),
      "options",
      "promptIndex",
    ];
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

  temperature = 1;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  logitBias?: Record<string, number>;

  maxTokens?: number;

  modelName = "gpt-3.5-turbo";

  prefixMessages?: ChatCompletionRequestMessage[];

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

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> &
      BaseLLMParams & {
        configuration?: ConfigurationParameters;
      },
    /** @deprecated */
    configuration?: ConfigurationParameters
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
  ): Omit<CreateChatCompletionRequest, "messages"> {
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
    return {
      model_name: this.modelName,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  private formatMessages(prompt: string): ChatCompletionRequestMessage[] {
    const message: ChatCompletionRequestMessage = {
      role: "user",
      content: prompt,
    };
    return this.prefixMessages ? [...this.prefixMessages, message] : [message];
  }

  // TODO(jacoblee): Refactor with _generate(..., {stream: true}) implementation
  // when we integrate OpenAI's new SDK.
  async *_streamResponseChunks(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    const params = {
      ...this.invocationParams(options),
      messages: this.formatMessages(prompt),
      stream: true,
    };
    const streamIterable = this.startStream(params, options);
    for await (const streamedResponse of streamIterable) {
      const data = JSON.parse(streamedResponse) as {
        choices?: Array<{
          index: number;
          finish_reason: string | null;
          delta: {
            role?: string;
            content?: string;
            function_call?: { name: string; arguments: string };
          };
        }>;
      };

      const choice = data.choices?.[0];
      if (!choice) {
        continue;
      }

      const { delta } = choice;
      const generationChunk = new GenerationChunk({
        text: delta.content ?? "",
      });
      yield generationChunk;
      // eslint-disable-next-line no-void
      void runManager?.handleLLMNewToken(generationChunk.text ?? "");
    }
  }

  startStream(
    request: CreateChatCompletionRequest,
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
  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const params = this.invocationParams(options);

    const data = params.stream
      ? await new Promise<CreateChatCompletionResponse>((resolve, reject) => {
          let response: CreateChatCompletionResponse;
          let rejected = false;
          let resolved = false;
          this.completionWithRetry(
            {
              ...params,
              messages: this.formatMessages(prompt),
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
                  resolve(response);
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

                  const message = data as {
                    id: string;
                    object: string;
                    created: number;
                    model: string;
                    choices: Array<{
                      index: number;
                      finish_reason: string | null;
                      delta: { content?: string; role?: string };
                    }>;
                  };

                  // on the first message set the response properties
                  if (!response) {
                    response = {
                      id: message.id,
                      object: message.object,
                      created: message.created,
                      model: message.model,
                      choices: [],
                    };
                  }

                  // on all messages, update choice
                  for (const part of message.choices) {
                    if (part != null) {
                      let choice = response.choices.find(
                        (c) => c.index === part.index
                      );

                      if (!choice) {
                        choice = {
                          index: part.index,
                          finish_reason: part.finish_reason ?? undefined,
                        };
                        response.choices.push(choice);
                      }

                      if (!choice.message) {
                        choice.message = {
                          role: part.delta
                            ?.role as ChatCompletionResponseMessageRoleEnum,
                          content: part.delta?.content ?? "",
                        };
                      }

                      choice.message.content += part.delta?.content ?? "";
                      // eslint-disable-next-line no-void
                      void runManager?.handleLLMNewToken(
                        part.delta?.content ?? "",
                        {
                          prompt: options.promptIndex ?? 0,
                          completion: part.index,
                        }
                      );
                    }
                  }

                  // when all messages are finished, resolve
                  if (
                    !resolved &&
                    !rejected &&
                    message.choices.every((c) => c.finish_reason != null)
                  ) {
                    resolved = true;
                    resolve(response);
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
            messages: this.formatMessages(prompt),
          },
          {
            signal: options.signal,
            ...options.options,
          }
        );

    return data.choices[0].message?.content ?? "";
  }

  /** @ignore */
  async completionWithRetry(
    request: CreateChatCompletionRequest,
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
    const axiosOptions = {
      adapter: isNode() ? undefined : fetchAdapter,
      ...this.clientConfig.baseOptions,
      ...options,
    } as StreamingAxiosConfiguration;
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
        this.client.createChatCompletion.bind(this.client),
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
 * PromptLayer wrapper to OpenAIChat
 */
export class PromptLayerOpenAIChat extends OpenAIChat {
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
    fields?: ConstructorParameters<typeof OpenAIChat>[0] & {
      promptLayerApiKey?: string;
      plTags?: string[];
      returnPromptLayerId?: boolean;
    }
  ) {
    super(fields);

    this.plTags = fields?.plTags ?? [];
    this.returnPromptLayerId = fields?.returnPromptLayerId ?? false;
    this.promptLayerApiKey =
      fields?.promptLayerApiKey ??
      getEnvironmentVariable("PROMPTLAYER_API_KEY");

    if (!this.promptLayerApiKey) {
      throw new Error("Missing PromptLayer API key");
    }
  }

  async completionWithRetry(
    request: CreateChatCompletionRequest,
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
    let choice: Generation[];

    const generations: Generation[][] = await Promise.all(
      prompts.map(async (prompt) => {
        const requestStartTime = Date.now();
        const text = await this._call(prompt, options, runManager);
        const requestEndTime = Date.now();

        choice = [{ text }];

        const parsedResp = {
          text,
        };
        const promptLayerRespBody = await promptLayerTrackRequest(
          this.caller,
          "langchain.PromptLayerOpenAIChat",
          [prompt],
          this._identifyingParams(),
          this.plTags,
          parsedResp,
          requestStartTime,
          requestEndTime,
          this.promptLayerApiKey
        );

        if (
          this.returnPromptLayerId === true &&
          promptLayerRespBody.success === true
        ) {
          choice[0].generationInfo = {
            promptLayerRequestId: promptLayerRespBody.request_id,
          };
        }

        return choice;
      })
    );

    return { generations };
  }
}
