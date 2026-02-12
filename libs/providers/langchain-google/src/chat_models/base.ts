import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  AIMessageChunkFields,
  BaseMessage,
} from "@langchain/core/messages";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { concat } from "@langchain/core/utils/stream";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { EventSourceParserStream } from "eventsource-parser/stream";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { ModelProfile } from "@langchain/core/language_models/profile";
import PROFILES from "./profiles.js";
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
} from "@langchain/core/language_models/base";
import {
  Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import {
  toJsonSchema,
  type JsonSchema7Type,
} from "@langchain/core/utils/json_schema";
import {
  InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  JsonOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";
import { JsonOutputKeyToolsParser } from "@langchain/core/output_parsers/openai_tools";

import { ApiClient } from "../clients/index.js";
import type { ChatGoogleFields } from "./types.js";
import { SafeJsonEventParserStream } from "../utils/stream.js";
import {
  convertAIMessageToText,
  convertGeminiCandidateToAIMessage,
  convertGeminiGenerateContentResponseToUsageMetadata,
  convertGeminiPartsToToolCalls,
  convertMessagesToGeminiContents,
  convertMessagesToGeminiSystemInstruction,
} from "../converters/messages.js";
import {
  ConfigurationError,
  MalformedOutputError,
  NoCandidatesError,
  PromptBlockedError,
  RequestError,
} from "../utils/errors.js";
import {
  convertToolsToGeminiTools,
  convertToolChoiceToGeminiConfig,
  schemaToGeminiParameters,
} from "../converters/tools.js";
import {
  convertParamsToPlatformType,
  convertFieldsToSpeechConfig,
  convertFieldsToThinkingConfig,
} from "../converters/params.js";
import { Gemini } from "./api-types.js";

export type GooglePlatformType = "gai" | "gcp";

export function getPlatformType(
  platform: GooglePlatformType | undefined,
  hasApiKey: boolean
): GooglePlatformType {
  if (typeof platform !== "undefined") {
    return platform;
  } else if (hasApiKey) {
    return "gai";
  } else {
    return "gcp";
  }
}

export interface BaseChatGoogleParams
  extends BaseChatModelParams,
    ChatGoogleFields {
  /**
   * The name of the Gemini model to use.
   *
   * Example: "gemini-3-pro-preview"
   */
  model: string;

  /**
   * Optional. The API client implementation for making HTTP requests to the Gemini API.
   * If not set, a default client will be used based on the runtime environment.
   */
  apiClient?: ApiClient;

  /**
   * Hostname for the API call (if this is running on GCP)
   * Usually this is computed based on location and platformType.
   **/
  endpoint?: string;

  /**
   * Region where the LLM is stored (if this is running on GCP)
   * Defaults to "global"
   **/
  location?: string;

  /**
   * The version of the API functions. Part of the path.
   * Usually this is computed based on platformType.
   **/
  apiVersion?: string;

  /**
   * What platform to run the service on.
   * If not specified, the class should determine this from other
   * means. Either way, the platform actually used will be in
   * the "platform" getter.
   */
  platformType?: GooglePlatformType;

  /**
   * For compatibility with Google's libraries, should this use Vertex?
   * The "platformType" parmeter takes precedence.
   */
  vertexai?: boolean;

  /**
   * Backwards compatibility.
   * @deprecated in favor of using `disableStreaming` or `.stream()`
   */
  streaming?: boolean;

  streamUsage?: boolean;
}

export interface BaseChatGoogleCallOptions
  extends BaseChatModelCallOptions,
    ChatGoogleFields {}

export abstract class BaseChatGoogle<
  CallOptions extends BaseChatGoogleCallOptions = BaseChatGoogleCallOptions
> extends BaseChatModel<CallOptions, AIMessageChunk> {
  model: string;

  streaming: boolean;

  disableStreaming: boolean;

  streamUsage: boolean = true;

  protected _platform?: GooglePlatformType;

  protected _endpoint?: string;

  protected _location?: string;

  protected _apiVersion?: string;

  protected apiClient: ApiClient;

  constructor(protected params: BaseChatGoogleParams) {
    super(params);

    if (!params.apiClient) {
      throw new ConfigurationError(
        "BaseChatGoogle requires an apiClient. This should be provided automatically by ChatGoogle constructors. If you're extending BaseChatGoogle directly, please provide an apiClient instance."
      );
    }
    this.apiClient = params.apiClient;

    this.model = params.model;
    this._platform = convertParamsToPlatformType(params);
    this._endpoint = params.endpoint;
    this._location = params.location;
    this._apiVersion = params.apiVersion;

    this.disableStreaming = params?.disableStreaming === true;
    this.streaming = params?.streaming === true;
    if (this.disableStreaming) this.streaming = false;
    // disable streaming in BaseChatModel if explicitly disabled
    if (params?.streaming === false) this.disableStreaming = true;

    this.streamUsage = params?.streamUsage ?? this.streamUsage;
    if (this.disableStreaming) this.streamUsage = false;
  }

  _llmType(): string {
    return "google";
  }

  protected get platformType(): GooglePlatformType | undefined {
    return this._platform;
  }

  protected get platform(): GooglePlatformType {
    return getPlatformType(this._platform, this.apiClient.hasApiKey());
  }

  protected get isVertexExpress(): boolean {
    return this.platform === "gcp" && this.apiClient.hasApiKey();
  }

  protected get apiVersion(): string {
    if (typeof this._apiVersion !== "undefined") {
      return this._apiVersion;
    } else if (this.platform === "gai") {
      return "v1beta";
    } else {
      return "v1";
    }
  }

  protected get location(): string {
    return this._location || "global";
  }

  protected get endpoint(): string {
    if (typeof this._endpoint !== "undefined") {
      return this._endpoint;
    } else if (this.platform === "gai") {
      return "generativelanguage.googleapis.com";
    } else if (this.isVertexExpress) {
      return "aiplatform.googleapis.com";
    } else if (this.location === "global") {
      // See https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations#use_the_global_endpoint
      return "aiplatform.googleapis.com";
    } else {
      return `${this.location}-aiplatform.googleapis.com`;
    }
  }

  protected get publisher(): string {
    return "google";
  }

  protected get urlMethod(): string {
    return this.streaming ? "streamGenerateContent?alt=sse" : "generateContent";
  }

  /**
   * Returns the model profile for this instance's model, describing its
   * capabilities and constraints (e.g. max tokens, input/output modalities,
   * tool calling support).
   *
   * @example
   * ```typescript
   * const model = new ChatGoogle({ model: "gemini-2.5-pro" });
   * const profile = model.profile;
   * console.log(profile.maxInputTokens); // 1048576
   * console.log(profile.imageInputs); // true
   * ```
   */
  get profile(): ModelProfile {
    return PROFILES[this.model] ?? {};
  }

  protected async buildUrlGemini(urlMethod?: string): Promise<string> {
    return `https://${this.endpoint}/${this.apiVersion}/models/${this.model}:${
      urlMethod ?? this.urlMethod
    }`;
  }

  protected async buildUrlVertexExpress(urlMethod?: string): Promise<string> {
    return `https://${this.endpoint}/${this.apiVersion}/publishers/${
      this.publisher
    }/models/${this.model}:${urlMethod ?? this.urlMethod}`;
  }

  protected async buildUrlVertexLocation(urlMethod?: string): Promise<string> {
    const projectId = await this.apiClient.getProjectId();
    return `https://${this.endpoint}/${
      this.apiVersion
    }/projects/${projectId}/locations/${this.location}/publishers/${
      this.publisher
    }/models/${this.model}:${urlMethod ?? this.urlMethod}`;
  }

  protected async buildUrlVertex(urlMethod?: string): Promise<string> {
    if (this.isVertexExpress) {
      return this.buildUrlVertexExpress(urlMethod);
    } else {
      return this.buildUrlVertexLocation(urlMethod);
    }
  }

  protected async buildUrl(urlMethod?: string): Promise<string> {
    switch (this.platform) {
      case "gai":
        return this.buildUrlGemini(urlMethod);
      default:
        return this.buildUrlVertex(urlMethod);
    }
  }

  override invocationParams(options: this["ParsedCallOptions"]) {
    const fields = combineGoogleChatModelFields(this.params, options);

    // Convert tools to Gemini format
    const tools = fields.tools
      ? convertToolsToGeminiTools(fields.tools)
      : undefined;

    // Convert tool choice to Gemini function calling config
    const toolConfig = convertToolChoiceToGeminiConfig(
      options.tool_choice,
      !!(tools && tools.length > 0)
    );

    let responseJsonSchema:
      | JsonSchema7Type
      | Record<string, unknown>
      | undefined;
    let responseMimeType: string | undefined;

    if (fields.responseSchema) {
      // Convert Zod schema to JSON Schema if needed
      if (isInteropZodSchema(fields.responseSchema)) {
        responseJsonSchema = toJsonSchema(fields.responseSchema);
      } else {
        responseJsonSchema = fields.responseSchema as Record<string, unknown>;
      }
      // Automatically set responseMimeType to "application/json" when schema is provided
      responseMimeType = "application/json";
    }

    return {
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(toolConfig ? { toolConfig } : {}),
      safetySettings: fields.safetySettings,
      generationConfig: {
        temperature: fields.temperature,
        topP: fields.topP,
        topK: fields.topK,
        maxOutputTokens: fields.maxOutputTokens,
        presencePenalty: fields.presencePenalty,
        frequencyPenalty: fields.frequencyPenalty,
        stopSequences: fields.stopSequences,
        ...(responseMimeType ? { responseMimeType } : {}),
        ...(responseJsonSchema ? { responseJsonSchema } : {}),
        ...(fields.responseModalities && fields.responseModalities.length > 0
          ? { responseModalities: fields.responseModalities }
          : {}),
        candidateCount: 1,
        seed: fields.seed,
        responseLogprobs: fields.responseLogprobs,
        logprobs: fields.logprobs,
        ...(fields.enableEnhancedCivicAnswers !== undefined
          ? { enableEnhancedCivicAnswers: fields.enableEnhancedCivicAnswers }
          : {}),
        thinkingConfig: convertFieldsToThinkingConfig(this.model, fields),
        speechConfig: convertFieldsToSpeechConfig(fields),
        ...(fields.imageConfig ? { imageConfig: fields.imageConfig } : {}),
        ...(fields.mediaResolution
          ? { mediaResolution: fields.mediaResolution }
          : {}),
      },
    };
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (this.streaming) {
      const stream = await this._streamResponseChunks(
        messages,
        options,
        runManager
      );
      let finalChunk: ChatGenerationChunk | null = null;
      for await (const chunk of stream) {
        finalChunk = !finalChunk ? chunk : concat(finalChunk, chunk);
      }
      if (
        typeof finalChunk?.message?.content === "string" &&
        typeof (
          finalChunk?.message?.additional_kwargs
            ?.originalTextContentBlock as Record<string, unknown>
        )?.text === "string"
      ) {
        (
          finalChunk.message.additional_kwargs
            .originalTextContentBlock as Record<string, unknown>
        ).text = finalChunk.message.content;
      }
      return {
        generations: finalChunk ? [finalChunk] : [],
      };
    }

    const url = await this.buildUrl();
    const body = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const moduleName = this.constructor.name;
    await runManager?.handleCustomEvent(`google-request-${moduleName}`, {
      url,
      body,
    });

    const response = await this.apiClient.fetch(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) {
      const error = await RequestError.fromResponse(response);
      await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
        error,
      });
      throw error;
    }

    const data: Gemini.GenerateContentResponse = await response.json();
    await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
      data,
      url: response.url,
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });

    // Check for prompt feedback errors
    if (data.promptFeedback?.blockReason) {
      throw PromptBlockedError.fromPromptFeedback(data.promptFeedback);
    }

    // Check if we have candidates
    if (!data.candidates || data.candidates.length === 0) {
      throw new NoCandidatesError();
    }

    // Use the first candidate
    const candidate = data.candidates[0];
    const message = convertGeminiCandidateToAIMessage(candidate);

    // Extract text content from the message
    const text = convertAIMessageToText(message);

    const usageMetadata =
      convertGeminiGenerateContentResponseToUsageMetadata(data);
    message.usage_metadata = usageMetadata;

    return {
      generations: [
        {
          text,
          message,
          generationInfo: {
            finishReason: candidate.finishReason,
            finishMessage: candidate.finishMessage,
            safetyRatings: candidate.safetyRatings,
            citationMetadata: candidate.citationMetadata,
            tokenCount: candidate.tokenCount,
          },
        },
      ],
      llmOutput: {
        tokenUsage: usageMetadata,
        model: data.modelVersion,
        responseId: data.responseId,
        usageMetadata,
      },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const streamUsage: boolean = this.streamUsage ?? true;

    const body = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const url = await this.buildUrl("streamGenerateContent?alt=sse");
    const moduleName = this.constructor.name;
    await runManager?.handleCustomEvent(`google-request-${moduleName}`, {
      url,
      body,
    });

    const response = await this.apiClient.fetch(
      new Request(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: options.signal,
      })
    );

    await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
      url: response.url,
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });

    if (!response.ok) {
      const error = await RequestError.fromResponse(response);
      await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
        error,
      });
      throw error;
    }

    if (response.body) {
      const stream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(
          new SafeJsonEventParserStream<Gemini.GenerateContentResponse>()
        )
        .pipeThrough(
          new TransformStream<
            Gemini.GenerateContentResponse,
            ChatGenerationChunk
          >({
            transform(chunk, controller) {
              // eslint-disable-next-line no-void
              void runManager?.handleCustomEvent(`google-chunk-${moduleName}`, {
                chunk,
              });
              if (chunk === null) {
                controller.enqueue(
                  new ChatGenerationChunk({
                    text: "",
                    message: new AIMessageChunk({ content: "" }),
                    generationInfo: { finishReason: "stop" },
                  })
                );
                return;
              }

              // Extract text delta from the chunk
              const candidate = chunk.candidates?.[0];
              if (!candidate) {
                return;
              }

              const message = convertGeminiCandidateToAIMessage(candidate);
              const text = convertAIMessageToText(message);

              const parts = candidate.content?.parts ?? [];
              const toolCalls = convertGeminiPartsToToolCalls(parts);

              // Only emit if we have content
              if (parts.length > 0 || candidate.finishReason) {
                const messageChunkParams: AIMessageChunkFields = {
                  content: message.content,
                  tool_calls: toolCalls,
                  response_metadata: {
                    model_provider: "google",
                  },
                  additional_kwargs: {
                    ...(message.additional_kwargs.originalTextContentBlock
                      ? {
                          originalTextContentBlock:
                            message.additional_kwargs.originalTextContentBlock,
                        }
                      : {}),
                    ...(candidate.finishReason
                      ? {
                          finishReason: candidate.finishReason,
                          finishMessage: candidate.finishMessage,
                        }
                      : {}),
                  },
                };

                // Include usageMetadata if there is any and we have
                // enabled it with streamUsage on
                if (chunk?.usageMetadata && streamUsage) {
                  messageChunkParams.usage_metadata =
                    convertGeminiGenerateContentResponseToUsageMetadata(chunk);
                }
                const messageChunk = new AIMessageChunk(messageChunkParams);

                controller.enqueue(
                  new ChatGenerationChunk({
                    text: text,
                    message: messageChunk,
                    generationInfo: {
                      ...(candidate.finishReason && {
                        finishReason: candidate.finishReason,
                        finishMessage: candidate.finishMessage,
                      }),
                      ...(candidate.safetyRatings && {
                        safetyRatings: candidate.safetyRatings,
                      }),
                    },
                  })
                );
              }
            },
          })
        );

      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield value;
          if (value.text) {
            await runManager?.handleLLMNewToken(
              value.text,
              undefined,
              undefined,
              undefined,
              undefined,
              { chunk: value }
            );
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }

  /**
   * Bind tool-like objects to this chat model.
   *
   * @param tools A list of tool definitions to bind to this chat model.
   * Can be a structured tool, an OpenAI formatted tool, or a Gemini function declaration.
   * @param kwargs Any additional parameters to bind.
   */
  bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<CallOptions>
  ): Runnable<BaseMessage[], AIMessageChunk, CallOptions> {
    return this.withConfig({
      ...kwargs,
      tools,
    } as Partial<CallOptions>);
  }

  /**
   * Get structured output from the model based on a schema.
   *
   * This method supports two modes:
   * - `jsonMode`: Uses `responseSchema` to get JSON responses directly (preferred for structured outputs)
   * - `functionCalling`: Uses function calling with tools (default, for compatibility)
   *
   * @param outputSchema - The schema to use for structured output (Zod schema or JSON Schema)
   * @param config - Configuration options including method and whether to include raw response
   * @returns A Runnable that returns the parsed structured output
   */
  withStructuredOutput<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunOutput extends Record<string, any> = Record<string, any>
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        { raw: BaseMessage; parsed: RunOutput }
      > {
    let llm: Runnable<BaseMessage[], AIMessageChunk, CallOptions>;
    let outputParser: Runnable<BaseMessage, RunOutput>;

    const { schema, name, includeRaw } = {
      ...config,
      schema: outputSchema,
    };
    let method = config?.method ?? "functionCalling";

    if (method === "jsonMode") {
      console.warn(
        `"jsonMode" is not supported for Google models. Falling back to "jsonSchema".`
      );
      method = "jsonSchema";
    }

    if (method === "jsonSchema") {
      // Use JSON mode with responseSchema
      llm = this.withConfig({
        responseSchema: schema,
      } as Partial<CallOptions>);

      outputParser = RunnableLambda.from<BaseMessage, RunOutput>(
        async (input: BaseMessage): Promise<RunOutput> => {
          if (
            !AIMessage.isInstance(input) &&
            !AIMessageChunk.isInstance(input)
          ) {
            throw new MalformedOutputError({
              message: "Input is not an AIMessage or AIMessageChunk.",
            });
          }

          if (!input.text) {
            throw new MalformedOutputError({
              message:
                "No content found in response. Cannot parse structured output.",
            });
          }

          // Parse JSON and validate with schema
          if (isInteropZodSchema(schema)) {
            const zodParser = StructuredOutputParser.fromZodSchema(
              schema as InteropZodType<RunOutput>
            );
            return (await zodParser.parse(input.text)) as RunOutput;
          } else {
            const jsonParser = new JsonOutputParser<RunOutput>();
            return await jsonParser.parse(input.text);
          }
        }
      );
    } else if (method === "functionCalling") {
      // Use function calling mode
      let functionName = name ?? "extract";
      let tools: Gemini.Tool[];

      if (isInteropZodSchema(schema)) {
        const jsonSchema = schemaToGeminiParameters(schema);
        const description =
          typeof jsonSchema.description === "string"
            ? jsonSchema.description
            : "A function available to call.";
        tools = [
          {
            functionDeclarations: [
              {
                name: functionName,
                description,
                parameters: jsonSchema as Gemini.Tools.Schema,
              },
            ],
          },
        ];
        outputParser = new JsonOutputKeyToolsParser({
          returnSingle: true,
          keyName: functionName,
          zodSchema: schema,
        });
      } else {
        let geminiFunctionDefinition: Gemini.Tools.FunctionDeclaration;
        if (
          typeof schema.name === "string" &&
          typeof schema.parameters === "object" &&
          schema.parameters != null
        ) {
          geminiFunctionDefinition = schema as Gemini.Tools.FunctionDeclaration;
          functionName = schema.name;
        } else {
          // We are providing the schema for *just* the parameters
          const parameters = schemaToGeminiParameters(schema);
          geminiFunctionDefinition = {
            name: functionName,
            description: (schema as { description?: string }).description ?? "",
            parameters,
          };
        }
        tools = [
          {
            functionDeclarations: [geminiFunctionDefinition],
          },
        ];
        outputParser = new JsonOutputKeyToolsParser<RunOutput>({
          returnSingle: true,
          keyName: functionName,
        });
      }

      llm = this.bindTools(tools).withConfig({
        tool_choice: functionName,
      } as Partial<CallOptions>);
    } else {
      throw new ConfigurationError(
        `Unrecognized structured output method '${method}'. Expected 'functionCalling' or 'jsonSchema'`
      );
    }

    // Shared logic for handling includeRaw
    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: "ChatGoogleStructuredOutput",
      }) as Runnable<BaseLanguageModelInput, RunOutput>;
    }

    const parserAssign = RunnablePassthrough.assign({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    });
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    });
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    });
    return RunnableSequence.from<
      BaseLanguageModelInput,
      { raw: BaseMessage; parsed: RunOutput }
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: "ChatGoogleStructuredOutputRunnable",
    });
  }
}

type CombinableFields = Omit<BaseChatGoogleParams, "model">;

export function combineGoogleChatModelFields(
  a: CombinableFields,
  b: CombinableFields,
  ...rest: CombinableFields[]
): CombinableFields {
  const combined: CombinableFields = {
    temperature: b.temperature ?? a.temperature,
    topP: b.topP ?? a.topP,
    topK: b.topK ?? a.topK,
    maxOutputTokens: b.maxOutputTokens ?? a.maxOutputTokens,
    presencePenalty: b.presencePenalty ?? a.presencePenalty,
    frequencyPenalty: b.frequencyPenalty ?? a.frequencyPenalty,
    stopSequences: b.stopSequences ?? a.stopSequences,
    seed: b.seed ?? a.seed,
    responseLogprobs: b.responseLogprobs ?? a.responseLogprobs,
    logprobs: b.logprobs ?? a.logprobs,
    safetySettings: b.safetySettings ?? a.safetySettings,
    responseSchema: b.responseSchema ?? a.responseSchema,
    tools: b.tools ?? a.tools,
    responseModalities: b.responseModalities ?? a.responseModalities,
    enableEnhancedCivicAnswers:
      b.enableEnhancedCivicAnswers ?? a.enableEnhancedCivicAnswers,
    speechConfig: b.speechConfig ?? a.speechConfig,
    imageConfig: b.imageConfig ?? a.imageConfig,
    mediaResolution: b.mediaResolution ?? a.mediaResolution,
    maxReasoningTokens: b.maxReasoningTokens ?? a.maxReasoningTokens,
    thinkingBudget: b.thinkingBudget ?? a.thinkingBudget,
    reasoningEffort: b.reasoningEffort ?? a.reasoningEffort,
    thinkingLevel: b.thinkingLevel ?? a.thinkingLevel,
  };
  if (rest.length > 0) {
    return combineGoogleChatModelFields(combined, rest[0], ...rest.slice(1));
  }
  return combined;
}

export function getGoogleChatModelParams<TParams extends BaseChatGoogleParams>(
  modelOrParams: string | TParams,
  paramsArg?: Omit<TParams, "model">
): TParams {
  const model =
    typeof modelOrParams === "string" ? modelOrParams : modelOrParams.model;
  const params = typeof modelOrParams === "string" ? paramsArg : modelOrParams;
  return { model, ...params } as TParams;
}
