import {
  AIMessageChunk,
  type AIMessageChunkFields,
  type BaseMessage,
  type UsageMetadata,
} from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import {
  type InteropZodType,
  isInteropZodSchema,
} from "@langchain/core/utils/types";
import {
  type SerializableSchema,
  isSerializableSchema,
} from "@langchain/core/utils/standard_schema";
import {
  toJsonSchema,
  type JsonSchema7Type,
} from "@langchain/core/utils/json_schema";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { GoogleChatApiHandler } from "./base.js";
import { SafeJsonEventParserStream } from "../../utils/stream.js";
import {
  subtractUsageMetadata,
  usageMetadataToTokenUsage,
} from "../../utils/metadata.js";
import { iife } from "../../utils/misc.js";
import {
  PromptBlockedError,
  NoCandidatesError,
  RequestError,
} from "../../utils/errors.js";
import {
  convertAIMessageToText,
  convertGeminiCandidateToAIMessage,
  convertGeminiGenerateContentResponseToUsageMetadata,
  convertGeminiPartsToToolCalls,
  convertMessagesToGeminiContents,
  convertMessagesToGeminiSystemInstruction,
} from "../../converters/generate_content/messages.js";
import {
  convertToolsToGeminiTools,
  convertToolChoiceToGeminiConfig,
  mixesBuiltinAndFunctionTools,
  schemaToGeminiParameters,
} from "../../converters/generate_content/tools.js";
import {
  combineGoogleChatModelFields,
  convertFieldsToSpeechConfig,
  convertFieldsToThinkingConfig,
  convertFieldsToServiceTier,
  mapDetailToMediaResolution,
} from "../../converters/generate_content/params.js";
import { convertGoogleGeminiStream } from "../../converters/generate_content/stream_events.js";
import type {
  BaseChatGoogleCallOptions,
  GenerateContentApiHandlerParams,
  GenerateContentInvocationParams,
  Gemini,
} from "../types.js";
import { settableServiceTier } from "../types.js";

type ServiceTier = Gemini.ServiceTier;

/**
 * Concrete wire protocol handler for Google's Generate Content API
 * (`/v1beta/models/{model}:generateContent` and `:streamGenerateContent`).
 */
export class GenerateContentApiHandler extends GoogleChatApiHandler<
  GenerateContentInvocationParams,
  GenerateContentApiHandlerParams
> {
  constructor(params: GenerateContentApiHandlerParams) {
    super(params);
  }

  protected get urlMethod(): string {
    return this.params.streaming
      ? "streamGenerateContent?alt=sse"
      : "generateContent";
  }

  protected getUrlSuffix(urlMethod?: string): string {
    const method = urlMethod ?? this.urlMethod;
    return `/models/${this.params.model}:${method}`;
  }

  override getHeaders(
    options?: BaseChatGoogleCallOptions
  ): Record<string, string> {
    const fields = combineGoogleChatModelFields(this.params, options);

    // The priority type is set via header only for Vertex
    const priorityHeaders: Record<string, string> =
      this.params.platform === "gcp" &&
      typeof fields.serviceTier !== "undefined" &&
      settableServiceTier.includes(fields.serviceTier)
        ? { "X-Vertex-AI-LLM-Shared-Request-Type": fields.serviceTier }
        : {};

    return {
      ...priorityHeaders,
      ...super.getHeaders(options),
    };
  }

  async generate(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const url = await this.buildUrl("generateContent");
    const headers = this.getHeaders(options);
    const body = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const moduleName = this.constructor.name;
    await runManager?.handleCustomEvent(`google-request-${moduleName}`, {
      url,
      headers,
      body,
    });

    let response: Response;
    try {
      response = await this.params.caller.callWithOptions(
        { signal: options?.signal, maxRetries: options?.maxRetries },
        async () => {
          const nextResponse = await this.params.apiClient.fetch(
            new Request(url, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
              signal: options?.signal,
            })
          );

          if (!nextResponse.ok) {
            throw await RequestError.fromResponse(nextResponse);
          }

          return nextResponse;
        }
      );
    } catch (error) {
      await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
        error,
      });
      throw error;
    }

    const data: Gemini.GenContent.GenerateContentResponse =
      await response.json();
    await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
      data,
      url: response.url,
      headers: Array.from(response.headers.entries()),
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

    const serviceTier: ServiceTier = iife((): ServiceTier => {
      // @ts-expect-error - trafficType is defined on Vertex, so isn't in the OpenAPI spec
      const trafficType: string | undefined = data.usageMetadata?.trafficType;

      // AI Studio replies with actual service type in the header
      const serviceTierHeader: string | null = response.headers.get(
        "x-gemini-service-tier"
      );

      if (trafficType?.startsWith("ON_DEMAND_")) {
        return trafficType?.substring("ON_DEMAND_".length).toLowerCase();
      }
      return serviceTierHeader || "standard";
    });

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
        tokenUsage: usageMetadataToTokenUsage(usageMetadata),
        model: data.modelVersion,
        responseId: data.responseId,
        usageMetadata,
        serviceTier,
      },
    };
  }

  async *streamResponseChunks(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const streamUsage: boolean =
      options?.streamUsage ?? this.params.streamUsage;

    const body = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const url = await this.buildUrl("streamGenerateContent?alt=sse");
    const headers = this.getHeaders(options);
    const moduleName = this.constructor.name;
    await runManager?.handleCustomEvent(`google-request-${moduleName}`, {
      url,
      headers,
      body,
    });

    let response: Response;
    try {
      response = await this.params.caller.callWithOptions(
        { signal: options?.signal, maxRetries: options?.maxRetries },
        async () => {
          const nextResponse = await this.params.apiClient.fetch(
            new Request(url, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
              signal: options?.signal,
            })
          );

          if (!nextResponse.ok) {
            throw await RequestError.fromResponse(nextResponse);
          }

          return nextResponse;
        }
      );
    } catch (error) {
      await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
        error,
      });
      throw error;
    }

    await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
      url: response.url,
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });

    if (response.body) {
      let previousUsage: UsageMetadata | undefined;
      const stream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(
          new SafeJsonEventParserStream<Gemini.GenContent.GenerateContentResponse>()
        )
        .pipeThrough(
          new TransformStream<
            Gemini.GenContent.GenerateContentResponse,
            ChatGenerationChunk
          >({
            transform(chunk, controller) {
              // oxlint-disable-next-line no-void
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

                if (chunk?.usageMetadata && streamUsage) {
                  const cumulative =
                    convertGeminiGenerateContentResponseToUsageMetadata(chunk);
                  messageChunkParams.usage_metadata = subtractUsageMetadata(
                    cumulative,
                    previousUsage
                  );
                  previousUsage = cumulative;
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
                      ...(candidate.citationMetadata && {
                        citationMetadata: candidate.citationMetadata,
                      }),
                      ...(candidate.groundingMetadata && {
                        groundingMetadata: candidate.groundingMetadata,
                        // Support entries for the first content part only (matches messages.ts).
                        groundingSupport:
                          candidate.groundingMetadata.groundingSupports?.filter(
                            (s) => (s?.segment?.partIndex ?? 0) === 0
                          ),
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
          await runManager?.handleLLMNewToken(
            value.text ?? "",
            undefined,
            undefined,
            undefined,
            undefined,
            { chunk: value }
          );
        }
      } finally {
        reader.releaseLock();
      }
    }
  }

  async *streamChatModelEvents(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent> {
    const body = {
      ...this.invocationParams(options),
      systemInstruction: convertMessagesToGeminiSystemInstruction(messages),
      contents: convertMessagesToGeminiContents(messages),
    };

    const url = await this.buildUrl("streamGenerateContent?alt=sse");
    const headers = this.getHeaders(options);

    const response = await this.params.apiClient.fetch(
      new Request(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: options?.signal,
      })
    );

    if (!response.ok) {
      throw await RequestError.fromResponse(response);
    }

    if (!response.body) {
      return;
    }

    const eventStream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeThrough(
        new SafeJsonEventParserStream<Gemini.GenContent.GenerateContentResponse>()
      );

    const shouldStreamUsage =
      this.params.streamUsage !== false && options?.streamUsage !== false;

    async function* geminiChunks(
      stream: ReadableStream<Gemini.GenContent.GenerateContentResponse | null>,
      signal?: AbortSignal
    ) {
      const reader = stream.getReader();
      try {
        while (true) {
          if (signal?.aborted) {
            return;
          }
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          if (value !== null) {
            yield value;
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    yield* convertGoogleGeminiStream(
      geminiChunks(eventStream, options?.signal),
      {
        streamUsage: shouldStreamUsage,
      }
    );
  }

  invocationParams(
    options?: BaseChatGoogleCallOptions
  ): GenerateContentInvocationParams {
    const fields = combineGoogleChatModelFields(this.params, options);
    const mediaResolution =
      fields.mediaResolution ?? mapDetailToMediaResolution(fields.detail);

    // Convert tools to Gemini format
    const tools = fields.tools
      ? convertToolsToGeminiTools(fields.tools)
      : undefined;

    // Convert tool choice to Gemini function calling config
    let toolConfig = convertToolChoiceToGeminiConfig(
      options?.tool_choice,
      !!(tools && tools.length > 0)
    );

    // Gemini rejects a mix of built-in and function-declaration tools unless
    // this is set. See mixesBuiltinAndFunctionTools's docstring.
    if (tools && mixesBuiltinAndFunctionTools(tools)) {
      toolConfig = {
        ...toolConfig,
        includeServerSideToolInvocations: true,
      };
    }

    let responseJsonSchema:
      | JsonSchema7Type
      | Record<string, unknown>
      | undefined;
    let responseMimeType: string | undefined = fields.responseMimeType;

    if (fields.responseSchema) {
      // Convert Zod schema to JSON Schema if needed
      if (
        isInteropZodSchema(fields.responseSchema) ||
        isSerializableSchema(fields.responseSchema)
      ) {
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
        thinkingConfig: convertFieldsToThinkingConfig(
          this.params.model,
          fields
        ),
        speechConfig: convertFieldsToSpeechConfig(fields),
        ...(fields.imageConfig ? { imageConfig: fields.imageConfig } : {}),
        ...(mediaResolution ? { mediaResolution } : {}),
      },
      ...convertFieldsToServiceTier(this.params.platform, fields),
    };
  }

  formatStructuredOutputTool(
    schema: InteropZodType | SerializableSchema | Record<string, unknown>,
    options?: { name?: string; description?: string }
  ): { tools: BindToolsInput[]; toolChoice: string; functionName: string } {
    let functionName = options?.name ?? "extract";
    let geminiFunctionDeclaration: Gemini.GenContent.Tools.FunctionDeclaration;

    if (isInteropZodSchema(schema) || isSerializableSchema(schema)) {
      const jsonSchema = schemaToGeminiParameters(schema);
      const description =
        options?.description ??
        (typeof jsonSchema.description === "string"
          ? jsonSchema.description
          : "A function available to call.");
      geminiFunctionDeclaration = {
        name: functionName,
        description,
        parameters: jsonSchema as Gemini.GenContent.Tools.Schema,
      };
    } else if (
      typeof (schema as { name?: unknown }).name === "string" &&
      typeof (schema as { parameters?: unknown }).parameters === "object" &&
      (schema as { parameters?: unknown }).parameters != null
    ) {
      geminiFunctionDeclaration =
        schema as Gemini.GenContent.Tools.FunctionDeclaration;
      functionName = (schema as { name: string }).name;
    } else {
      // We are providing the schema for *just* the parameters
      const parameters = schemaToGeminiParameters(schema);
      geminiFunctionDeclaration = {
        name: functionName,
        description:
          options?.description ??
          (schema as { description?: string }).description ??
          "",
        parameters,
      };
    }

    return {
      tools: [
        {
          functionDeclarations: [geminiFunctionDeclaration],
        },
      ],
      toolChoice: functionName,
      functionName,
    };
  }
}
