import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { BaseLLMParams, LLM } from "@langchain/core/language_models/llms";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { GenerationChunk, LLMResult } from "@langchain/core/outputs";
import { FIMCompletionRequest as MistralAIFIMCompletionRequest } from "@mistralai/mistralai/models/components/fimcompletionrequest.js";
import { FIMCompletionStreamRequest as MistralAIFIMCompletionStreamRequest } from "@mistralai/mistralai/models/components/fimcompletionstreamrequest.js";
import { FIMCompletionResponse as MistralAIFIMCompletionResponse } from "@mistralai/mistralai/models/components/fimcompletionresponse.js";
import { ChatCompletionRequest as MistralAIChatCompletionRequest } from "@mistralai/mistralai/models/components/chatcompletionrequest.js";
import { ChatCompletionStreamRequest as MistralAIChatCompletionStreamRequest } from "@mistralai/mistralai/models/components/chatcompletionstreamrequest.js";
import { ChatCompletionResponse as MistralAIChatCompletionResponse } from "@mistralai/mistralai/models/components/chatcompletionresponse.js";
import { ChatCompletionChoice as MistralAIChatCompletionChoice } from "@mistralai/mistralai/models/components/chatcompletionchoice.js";
import { CompletionEvent as MistralAIChatCompletionEvent } from "@mistralai/mistralai/models/components/completionevent.js";
import { CompletionChunk as MistralAICompetionChunk } from "@mistralai/mistralai/models/components/completionchunk.js";
import {
  BeforeRequestHook,
  RequestErrorHook,
  ResponseHook,
  HTTPClient as MistralAIHTTPClient,
} from "@mistralai/mistralai/lib/http.js";
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
   * Override the default server URL used by the Mistral SDK.
   * @deprecated use serverURL instead
   */
  endpoint?: string;
  /**
   * Override the default server URL used by the Mistral SDK.
   */
  serverURL?: string;
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
  /**
   * A list of custom hooks that must follow (req: Request) => Awaitable<Request | void>
   * They are automatically added when a ChatMistralAI instance is created
   */
  beforeRequestHooks?: BeforeRequestHook[];
  /**
   * A list of custom hooks that must follow (err: unknown, req: Request) => Awaitable<void>
   * They are automatically added when a ChatMistralAI instance is created
   */
  requestErrorHooks?: RequestErrorHook[];
  /**
   * A list of custom hooks that must follow (res: Response, req: Request) => Awaitable<void>
   * They are automatically added when a ChatMistralAI instance is created
   */
  responseHooks?: ResponseHook[];
  /**
   * Optional custom HTTP client to manage API requests
   * Allows users to add custom fetch implementations, hooks, as well as error and response processing.
   */
  httpClient?: MistralAIHTTPClient;
  /**
   * Whether to use the Fill-In-Middle (FIM) API for code completion.
   * When true, uses `client.fim.complete()` / `client.fim.stream()`.
   * When false, uses `client.chat.complete()` / `client.chat.stream()` with the prompt wrapped as a user message.
   *
   * FIM is only supported for code models like `codestral-latest`.
   * For general-purpose models like `mistral-large-latest`, set this to `false`.
   *
   * @default true for codestral models, false for other models
   */
  useFim?: boolean;
}

/**
 * Helper function to determine if a model is a codestral (FIM-compatible) model.
 * @param model The model name to check.
 * @returns True if the model is a codestral model, false otherwise.
 */
function isCodestralModel(model: string): boolean {
  const lowerModel = model.toLowerCase();
  return lowerModel.includes("codestral");
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

  lc_namespace = ["langchain", "llms", "mistralai"];

  lc_serializable = true;

  model = "codestral-latest";

  temperature = 0;

  topP?: number;

  maxTokens?: number | undefined;

  randomSeed?: number | undefined;

  streaming = false;

  batchSize = 20;

  apiKey: string;

  /**
   * @deprecated use serverURL instead
   */
  endpoint: string;

  serverURL?: string;

  maxRetries?: number;

  maxConcurrency?: number;

  beforeRequestHooks?: Array<BeforeRequestHook>;

  requestErrorHooks?: Array<RequestErrorHook>;

  responseHooks?: Array<ResponseHook>;

  httpClient?: MistralAIHTTPClient;

  useFim: boolean;

  constructor(fields?: MistralAIInput) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.topP = fields?.topP ?? this.topP;
    this.maxTokens = fields?.maxTokens ?? this.maxTokens;
    this.randomSeed = fields?.randomSeed ?? this.randomSeed;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.streaming = fields?.streaming ?? this.streaming;
    this.serverURL = fields?.serverURL ?? this.serverURL;
    this.maxRetries = fields?.maxRetries;
    this.maxConcurrency = fields?.maxConcurrency;
    this.beforeRequestHooks =
      fields?.beforeRequestHooks ?? this.beforeRequestHooks;
    this.requestErrorHooks =
      fields?.requestErrorHooks ?? this.requestErrorHooks;
    this.responseHooks = fields?.responseHooks ?? this.responseHooks;
    this.httpClient = fields?.httpClient ?? this.httpClient;
    // Default useFim based on model - true for codestral models, false for others
    this.useFim = fields?.useFim ?? isCodestralModel(this.model);

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("MISTRAL_API_KEY");
    if (!apiKey) {
      throw new Error(
        `MistralAI requires an API key to be set.
Either provide one via the "apiKey" field in the constructor, or set the "MISTRAL_API_KEY" environment variable.`
      );
    }
    this.apiKey = apiKey;

    this.addAllHooksToHttpClient();
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "MISTRAL_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "mistral_api_key",
    };
  }

  _llmType() {
    return "mistralai";
  }

  invocationParams(
    options: this["ParsedCallOptions"]
  ): Omit<
    MistralAIFIMCompletionRequest | MistralAIFIMCompletionStreamRequest,
    "prompt"
  > {
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
    let content = result?.choices?.[0].message.content ?? "";
    if (Array.isArray(content)) {
      content = content[0].type === "text" ? content[0].text : "";
    }
    return content;
  }

  async _generate(
    prompts: string[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<LLMResult> {
    const subPrompts = chunkArray(prompts, this.batchSize);
    const choices: MistralAIChatCompletionChoice[][] = [];

    const params = this.invocationParams(options);

    for (let i = 0; i < subPrompts.length; i += 1) {
      const data = await (async () => {
        if (this.streaming) {
          const responseData: Array<
            { choices: MistralAIChatCompletionChoice[] } & Partial<
              Omit<MistralAICompetionChunk, "choices">
            >
          > = [];
          for (let x = 0; x < subPrompts[i].length; x += 1) {
            const choices: MistralAIChatCompletionChoice[] = [];
            let response:
              | Omit<MistralAICompetionChunk, "choices" | "usage">
              | undefined;
            const stream = await this.completionWithRetry(
              {
                ...params,
                prompt: subPrompts[i][x],
              },
              options,
              true
            );
            for await (const { data } of stream) {
              // on the first message set the response properties
              if (!response) {
                response = {
                  id: data.id,
                  object: "chat.completion",
                  created: data.created,
                  model: data.model,
                };
              }

              // on all messages, update choice
              for (const part of data.choices) {
                let content = part.delta.content ?? "";
                // Convert MistralContentChunk data into a string
                if (Array.isArray(content)) {
                  let strContent = "";
                  for (const contentChunk of content) {
                    if (contentChunk.type === "text") {
                      strContent += contentChunk.text;
                    } else if (contentChunk.type === "image_url") {
                      const imageURL =
                        typeof contentChunk.imageUrl === "string"
                          ? contentChunk.imageUrl
                          : contentChunk.imageUrl.url;
                      strContent += imageURL;
                    }
                  }
                  content = strContent;
                }
                if (!choices[part.index]) {
                  choices[part.index] = {
                    index: part.index,
                    message: {
                      role: "assistant",
                      content,
                      toolCalls: null,
                    },
                    finishReason: part.finishReason ?? "length",
                  };
                } else {
                  const choice = choices[part.index];
                  choice.message.content += content;
                  choice.finishReason = part.finishReason ?? "length";
                }
                // eslint-disable-next-line no-void
                void runManager?.handleLLMNewToken(content, {
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
          const responseData: Array<MistralAIFIMCompletionResponse> = [];
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

      choices.push(...data.map((d) => d.choices ?? []));
    }

    const generations = choices.map((promptChoices) =>
      promptChoices.map((choice) => {
        let text = choice.message?.content ?? "";
        if (Array.isArray(text)) {
          text = text[0].type === "text" ? text[0].text : "";
        }
        return {
          text,
          generationInfo: {
            finishReason: choice.finishReason,
          },
        };
      })
    );
    return {
      generations,
    };
  }

  async completionWithRetry(
    request: MistralAIFIMCompletionRequest,
    options: this["ParsedCallOptions"],
    stream: false
  ): Promise<MistralAIFIMCompletionResponse | MistralAIChatCompletionResponse>;

  async completionWithRetry(
    request: MistralAIFIMCompletionStreamRequest,
    options: this["ParsedCallOptions"],
    stream: true
  ): Promise<AsyncIterable<MistralAIChatCompletionEvent>>;

  async completionWithRetry(
    request:
      | MistralAIFIMCompletionRequest
      | MistralAIFIMCompletionStreamRequest,
    options: this["ParsedCallOptions"],
    stream: boolean
  ): Promise<
    | MistralAIFIMCompletionResponse
    | MistralAIChatCompletionResponse
    | AsyncIterable<MistralAIChatCompletionEvent>
  > {
    const { Mistral } = await this.imports();
    const caller = new AsyncCaller({
      maxConcurrency: options.maxConcurrency || this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const client = new Mistral({
      apiKey: this.apiKey,
      serverURL: this.serverURL,
      timeoutMs: options.timeout,
      // If httpClient exists, pass it into constructor
      ...(this.httpClient ? { httpClient: this.httpClient } : {}),
    });
    return caller.callWithOptions(
      {
        signal: options.signal,
      },
      async () => {
        try {
          let res:
            | MistralAIFIMCompletionResponse
            | MistralAIChatCompletionResponse
            | AsyncIterable<MistralAIChatCompletionEvent>;

          if (this.useFim) {
            // Use FIM API for code completion models like codestral
            if (stream) {
              res = await client.fim.stream(request);
            } else {
              res = await client.fim.complete(request);
            }
          } else {
            // Use Chat API for general-purpose models
            // Convert the prompt to a chat message format
            const chatRequest:
              | MistralAIChatCompletionRequest
              | MistralAIChatCompletionStreamRequest = {
              model: request.model,
              messages: [{ role: "user", content: request.prompt }],
              temperature: request.temperature,
              maxTokens: request.maxTokens,
              topP: request.topP,
              randomSeed: request.randomSeed,
              stop: request.stop,
            };
            if (stream) {
              res = await client.chat.stream(chatRequest);
            } else {
              res = await client.chat.complete(chatRequest);
            }
          }
          return res;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
          if (
            e.message?.includes("status: 400") ||
            e.message?.toLowerCase().includes("status 400") ||
            e.message?.includes("validation failed")
          ) {
            e.status = 400;
          }
          throw e;
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
    for await (const message of stream) {
      const { data } = message;
      const choice = data?.choices[0];
      if (!choice) {
        continue;
      }
      let text = choice.delta.content ?? "";
      if (Array.isArray(text)) {
        text = text[0].type === "text" ? text[0].text : "";
      }
      const chunk = new GenerationChunk({
        text,
        generationInfo: {
          finishReason: choice.finishReason,
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

  addAllHooksToHttpClient() {
    try {
      // To prevent duplicate hooks
      this.removeAllHooksFromHttpClient();

      // If the user wants to use hooks, but hasn't created an HTTPClient yet
      const hasHooks = [
        this.beforeRequestHooks,
        this.requestErrorHooks,
        this.responseHooks,
      ].some((hook) => hook && hook.length > 0);
      if (hasHooks && !this.httpClient) {
        this.httpClient = new MistralAIHTTPClient();
      }

      if (this.beforeRequestHooks) {
        for (const hook of this.beforeRequestHooks) {
          this.httpClient?.addHook("beforeRequest", hook);
        }
      }

      if (this.requestErrorHooks) {
        for (const hook of this.requestErrorHooks) {
          this.httpClient?.addHook("requestError", hook);
        }
      }

      if (this.responseHooks) {
        for (const hook of this.responseHooks) {
          this.httpClient?.addHook("response", hook);
        }
      }
    } catch {
      throw new Error("Error in adding all hooks");
    }
  }

  removeAllHooksFromHttpClient() {
    try {
      if (this.beforeRequestHooks) {
        for (const hook of this.beforeRequestHooks) {
          this.httpClient?.removeHook("beforeRequest", hook);
        }
      }

      if (this.requestErrorHooks) {
        for (const hook of this.requestErrorHooks) {
          this.httpClient?.removeHook("requestError", hook);
        }
      }

      if (this.responseHooks) {
        for (const hook of this.responseHooks) {
          this.httpClient?.removeHook("response", hook);
        }
      }
    } catch {
      throw new Error("Error in removing hooks");
    }
  }

  removeHookFromHttpClient(
    hook: BeforeRequestHook | RequestErrorHook | ResponseHook
  ) {
    try {
      this.httpClient?.removeHook("beforeRequest", hook as BeforeRequestHook);
      this.httpClient?.removeHook("requestError", hook as RequestErrorHook);
      this.httpClient?.removeHook("response", hook as ResponseHook);
    } catch {
      throw new Error("Error in removing hook");
    }
  }

  /** @ignore */
  private async imports() {
    const { Mistral } = await import("@mistralai/mistralai");
    return { Mistral };
  }
}
