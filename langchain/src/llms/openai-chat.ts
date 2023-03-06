import {
  Configuration,
  OpenAIApi,
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  ConfigurationParameters,
} from "openai";
import type { IncomingMessage } from "http";
import { createParser } from "eventsource-parser";
import { backOff } from "exponential-backoff";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { LLM } from "./base.js";
import { LLMCallbackManager } from "../schema/index.js";

interface ModelParams {
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
}

/**
 * Input to OpenAI class.
 * @augments ModelParams
 */
interface OpenAIInput extends ModelParams {
  /** Model name to use */
  modelName: string;

  /** ChatGPT messages to pass as a prefix to the prompt */
  prefixMessages?: ChatCompletionRequestMessage[];

  /** Holds any additional parameters that are valid to pass to {@link
   * https://platform.openai.com/docs/api-reference/completions/create |
   * `openai.create`} that are not explicitly specified on this class.
   */
  modelKwargs?: Kwargs;

  /** Maximum number of retries to make when generating */
  maxRetries: number;

  /** List of stop words to use when generating */
  stop?: string[];
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
 *
 * @augments BaseLLM
 * @augments OpenAIInput
 */
export class OpenAIChat extends LLM implements OpenAIInput {
  temperature = 1;

  topP = 1;

  frequencyPenalty = 0;

  presencePenalty = 0;

  n = 1;

  logitBias?: Record<string, number>;

  modelName = "gpt-3.5-turbo";

  prefixMessages?: ChatCompletionRequestMessage[];

  modelKwargs?: Kwargs;

  maxRetries = 6;

  stop?: string[];

  streaming = false;

  // Used for non-streaming requests
  private batchClient: OpenAIApi;

  // Used for streaming requests
  private streamingClient: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<OpenAIInput> & {
      callbackManager?: LLMCallbackManager;
      concurrency?: number;
      cache?: boolean;
      verbose?: boolean;
      openAIApiKey?: string;
    },
    configuration?: ConfigurationParameters
  ) {
    super(
      fields?.callbackManager,
      fields?.verbose,
      fields?.concurrency,
      fields?.cache
    );

    const apiKey = fields?.openAIApiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.prefixMessages = fields?.prefixMessages ?? this.prefixMessages;
    this.modelKwargs = fields?.modelKwargs ?? {};
    this.maxRetries = fields?.maxRetries ?? this.maxRetries;

    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.frequencyPenalty = fields?.frequencyPenalty ?? this.frequencyPenalty;
    this.presencePenalty = fields?.presencePenalty ?? this.presencePenalty;
    this.n = fields?.n ?? this.n;
    this.logitBias = fields?.logitBias;
    this.stop = fields?.stop;

    this.streaming = fields?.streaming ?? false;

    if (this.streaming && this.n > 1) {
      throw new Error("Cannot stream results when n > 1");
    }

    this.clientConfig = {
      apiKey: fields?.openAIApiKey ?? process.env.OPENAI_API_KEY,
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

  /**
   * Call out to OpenAI's endpoint with k unique prompts
   *
   * @param prompt - The prompt to pass into the model.
   * @param [stop] - Optional list of stop words to use when generating.
   *
   * @returns The full LLM output.
   *
   * @example
   * ```ts
   * import { OpenAI } from "langchain/llms";
   * const openai = new OpenAI();
   * const response = await openai.generate(["Tell me a joke."]);
   * ```
   */
  async _call(prompt: string, stop?: string[]): Promise<string> {
    if (this.stop && stop) {
      throw new Error("Stop found in input and default params");
    }

    const params = this.invocationParams();
    params.stop = stop ?? params.stop;

    const { data } = await this.completionWithRetry({
      ...params,
      messages: this.formatMessages(prompt),
    });

    let completion = "";

    if (params.stream) {
      completion = await new Promise<string>((resolve, reject) => {
        let innerCompletion = "";
        const parser = createParser((event) => {
          if (event.type === "event") {
            if (event.data === "[DONE]") {
              resolve(innerCompletion);
            } else {
              const response = JSON.parse(event.data) as {
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

              const part = response.choices[0];
              if (part != null) {
                innerCompletion += part.delta?.content ?? "";

                this.callbackManager.handleNewToken?.(
                  part.delta?.content ?? "",
                  this.verbose
                );
              }
            }
          }
        });

        // workaround for incorrect axios types
        const stream = data as unknown as IncomingMessage;
        stream.on("data", (data: Buffer) =>
          parser.feed(data.toString("utf-8"))
        );
        stream.on("error", (error) => reject(error));
      });
    } else {
      completion = data.choices[0].message?.content ?? "";
    }
    return completion;
  }

  /** @ignore */
  async completionWithRetry(request: CreateChatCompletionRequest) {
    if (!request.stream && !this.batchClient) {
      const clientConfig = new Configuration({
        ...this.clientConfig,
        baseOptions: { adapter: fetchAdapter },
      });
      this.batchClient = new OpenAIApi(clientConfig);
    }
    if (request.stream && !this.streamingClient) {
      const clientConfig = new Configuration(this.clientConfig);
      this.streamingClient = new OpenAIApi(clientConfig);
    }
    const client = !request.stream ? this.batchClient : this.streamingClient;
    const makeCompletionRequest = async () =>
      client.createChatCompletion(
        request,
        request.stream ? { responseType: "stream" } : undefined
      );
    return backOff(makeCompletionRequest, {
      startingDelay: 4,
      maxDelay: 10,
      numOfAttempts: this.maxRetries,
      // TODO(sean) pass custom retry function to check error types.
    });
  }

  _llmType() {
    return "openai";
  }
}
