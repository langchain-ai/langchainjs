import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  ConfigurationParameters,
  ChatCompletionResponseMessageRoleEnum,
  CreateChatCompletionResponse,
} from "openai";
import type { AxiosRequestConfig } from "axios";
import type { StreamingAxiosConfiguration } from "../util/axios-types.js";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { BaseLLMCallOptions, BaseLLMParams, LLM } from "./base.js";
import { CallbackManagerForLLMRun } from "../callbacks/manager.js";

/**
 * Input to OpenAI class.
 */
export interface OpenAIChatInput {
  /** Sampling temperature to use, between 0 and 2, defaults to 1 */
  temperature: number;

  /** Total probability mass of tokens to consider at each step, between 0 and 1, defaults to 1 */
  topP: number;

  /** Penalizes repeated tokens according to frequency */
  frequencyPenalty: number;

  /** Penalizes repeated tokens */
  presencePenalty: number;

  /** Number of chat completions to generate for each prompt */
  n: number;

  /** Dictionary used to adjust the probability of specific tokens being generated */
  logitBias?: Record<string, number>;

  /** Whether to stream the results or not */
  streaming: boolean;

  /** Model name to use */
  modelName: string;

  /** ChatGPT messages to pass as a prefix to the prompt */
  prefixMessages?: ChatCompletionRequestMessage[];

  /** Holds any additional parameters that are valid to pass to {@link
   * https://platform.openai.com/docs/api-reference/completions/create |
   * `openai.create`} that are not explicitly specified on this class.
   */
  modelKwargs?: Kwargs;

  /** List of stop words to use when generating */
  stop?: string[];

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;

  /**
   * Maximum number of tokens to generate in the completion.  If not specified,
   * defaults to the maximum number of tokens allowed by the model.
   */
  maxTokens?: number;
}

export interface OpenAIChatCallOptions extends BaseLLMCallOptions {
  /**
   * List of stop words to use when generating
   */
  stop?: string[];

  /**
   * Additional options to pass to the underlying axios request.
   */
  options?: AxiosRequestConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

/**
 * Wrapper around OpenAI large language models that use the Chat endpoint.
 *
 * To use you should have the `openai` package installed, with the
 * `OPENAI_API_KEY` environment variable set.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://platform.openai.com/docs/api-reference/chat/create |
 * `openai.createCompletion`} can be passed through {@link modelKwargs}, even
 * if not explicitly available on this class.
 */
export class OpenAIChat extends LLM implements OpenAIChatInput {
  declare CallOptions: OpenAIChatCallOptions;

  temperature = 1;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  logitBias?: Record<string, number>;

  maxTokens?: number;

  modelName = "gpt-3.5-turbo";

  prefixMessages?: ChatCompletionRequestMessage[];

  modelKwargs?: Kwargs;

  timeout?: number;

  stop?: string[];

  streaming = false;

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIChatInput> &
      BaseLLMParams & {
        openAIApiKey?: string;
      },
    configuration?: ConfigurationParameters
  ) {
    super(fields ?? {});

    const apiKey =
      fields?.openAIApiKey ??
      // eslint-disable-next-line no-process-env
      (typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined);
    if (!apiKey) {
      throw new Error("OpenAI API key not found");
    }

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

    this.streaming = fields?.streaming ?? false;

    if (this.streaming && this.n > 1) {
      throw new Error("Cannot stream results when n > 1");
    }

    this.clientConfig = {
      apiKey,
      ...configuration,
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): Omit<CreateChatCompletionRequest, "messages"> & Kwargs {
    return {
      model: this.modelName,
      temperature: this.temperature,
      top_p: this.topP,
      frequency_penalty: this.frequencyPenalty,
      presence_penalty: this.presencePenalty,
      n: this.n,
      logit_bias: this.logitBias,
      max_tokens: this.maxTokens,
      stop: this.stop,
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

  /** @ignore */
  async _call(
    prompt: string,
    stopOrOptions?: string[] | this["CallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const stop = Array.isArray(stopOrOptions)
      ? stopOrOptions
      : stopOrOptions?.stop;
    const options = Array.isArray(stopOrOptions)
      ? {}
      : stopOrOptions?.options ?? {};

    if (this.stop && stop) {
      throw new Error("Stop found in input and default params");
    }

    const params = this.invocationParams();
    params.stop = stop ?? params.stop;

    const data = params.stream
      ? await new Promise<CreateChatCompletionResponse>((resolve, reject) => {
          let response: CreateChatCompletionResponse;
          let rejected = false;
          this.completionWithRetry(
            {
              ...params,
              messages: this.formatMessages(prompt),
            },
            {
              ...options,
              responseType: "stream",
              onmessage: (event) => {
                if (event.data?.trim?.() === "[DONE]") {
                  resolve(response);
                } else {
                  const message = JSON.parse(event.data) as {
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
                  const part = message.choices[0];
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
                      part.delta?.content ?? ""
                    );
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
          options
        );

    return data.choices[0].message?.content ?? "";
  }

  /** @ignore */
  async completionWithRetry(
    request: CreateChatCompletionRequest,
    options?: StreamingAxiosConfiguration
  ) {
    if (!this.client) {
      const clientConfig = new Configuration({
        ...this.clientConfig,
        baseOptions: {
          timeout: this.timeout,
          adapter: fetchAdapter,
          ...this.clientConfig.baseOptions,
        },
      });
      this.client = new OpenAIApi(clientConfig);
    }
    return this.caller
      .call(
        this.client.createChatCompletion.bind(this.client),
        request,
        options
      )
      .then((res) => res.data);
  }

  _llmType() {
    return "openai";
  }
}
