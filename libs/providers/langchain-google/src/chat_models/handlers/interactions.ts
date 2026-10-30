import type { BaseMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
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
import { EventSourceParserStream } from "eventsource-parser/stream";
import { GoogleChatApiHandler } from "./base.js";
import { SafeJsonEventParserStream } from "../../utils/stream.js";
import { usageMetadataToTokenUsage } from "../../utils/metadata.js";
import { iife } from "../../utils/misc.js";
import { NoCandidatesError, RequestError } from "../../utils/errors.js";
import { convertAIMessageToText } from "../../converters/generate_content/messages.js";
import { schemaToGeminiParameters } from "../../converters/generate_content/tools.js";
import {
  convertInteractionToAIMessage,
  convertMessagesToInteractionsInput,
  convertMessagesToInteractionsSystemInstruction,
} from "../../converters/interactions/messages.js";
import {
  convertToolsToInteractionsTools,
  convertToolChoiceToInteractionsConfig,
} from "../../converters/interactions/tools.js";
import {
  combineInteractionsFields,
  convertFieldsToInteractionsImageConfig,
  convertFieldsToInteractionsResponseFormat,
  convertFieldsToInteractionsResponseModalities,
  convertFieldsToInteractionsServiceTier,
  convertFieldsToInteractionsSpeechConfig,
  convertFieldsToInteractionsThinking,
  convertMediaResolutionToInteractions,
  convertSafetySettingsToInteractions,
} from "../../converters/interactions/params.js";
import {
  convertInteractionsStream,
  convertInteractionsStreamToChunks,
} from "../../converters/interactions/stream_events.js";
import type {
  BaseChatGoogleCallOptions,
  InteractionsApiHandlerParams,
  InteractionsInvocationParams,
  Gemini,
} from "../types.js";
import { settableServiceTier } from "../types.js";

type ServiceTier = Gemini.ServiceTier;

/**
 * Concrete wire protocol handler for Google's Interactions API
 * (`/v1beta/interactions` and `/v1beta/interactions?alt=sse`).
 */
export class InteractionsApiHandler extends GoogleChatApiHandler<
  InteractionsInvocationParams,
  InteractionsApiHandlerParams
> {
  constructor(params: InteractionsApiHandlerParams) {
    super(params);
  }

  protected get urlMethod(): string {
    return this.params.streaming ? "interactions?alt=sse" : "interactions";
  }

  protected getUrlSuffix(urlMethod?: string): string {
    const method = urlMethod ?? this.urlMethod;
    if (
      method === "stream" ||
      method.includes("alt=sse") ||
      method.includes("stream")
    ) {
      return "/interactions?alt=sse";
    }
    return "/interactions";
  }

  override getHeaders(
    options?: BaseChatGoogleCallOptions
  ): Record<string, string> {
    const fields = combineInteractionsFields(this.params, options ?? {});

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
    const url = await this.buildUrl("interactions");
    const headers = this.getHeaders(options);
    const fields = combineInteractionsFields(this.params, options ?? {});
    const mediaResolution = convertMediaResolutionToInteractions(
      fields.mediaResolution,
      fields.detail
    );
    const systemInstruction =
      convertMessagesToInteractionsSystemInstruction(messages);
    const input = convertMessagesToInteractionsInput(messages, mediaResolution);

    const body: Gemini.Interactions.CreateInteractionParameters = {
      ...this.invocationParams(options),
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      input,
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

    const data: Gemini.Interactions.Interaction = await response.json();
    await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
      data,
      url: response.url,
      headers: Array.from(response.headers.entries()),
      status: response.status,
      statusText: response.statusText,
    });

    const { message, finishReason, usageMetadata } =
      convertInteractionToAIMessage(data);

    if (
      data.status === "failed" &&
      (!data.steps || data.steps.length === 0) &&
      (!data.outputs || data.outputs.length === 0)
    ) {
      throw new NoCandidatesError();
    }

    const text = convertAIMessageToText(message);

    const serviceTier: ServiceTier = iife((): ServiceTier => {
      const serviceTierHeader: string | null = response.headers.get(
        "x-gemini-service-tier"
      );
      return (data.service_tier ??
        serviceTierHeader ??
        "standard") as ServiceTier;
    });

    return {
      generations: [
        {
          text,
          message,
          generationInfo: {
            ...(finishReason ? { finishReason } : {}),
            ...(message.response_metadata?.citationMetadata
              ? {
                  citationMetadata: message.response_metadata.citationMetadata,
                }
              : {}),
            ...(message.response_metadata?.groundingMetadata
              ? {
                  groundingMetadata:
                    message.response_metadata.groundingMetadata,
                }
              : {}),
          },
        },
      ],
      llmOutput: {
        tokenUsage: usageMetadata
          ? usageMetadataToTokenUsage(usageMetadata)
          : undefined,
        model: data.model ?? this.params.model,
        responseId: data.id,
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
      options?.streamUsage ?? this.params.streamUsage ?? false;

    const fields = combineInteractionsFields(this.params, options ?? {});
    const mediaResolution = convertMediaResolutionToInteractions(
      fields.mediaResolution,
      fields.detail
    );
    const systemInstruction =
      convertMessagesToInteractionsSystemInstruction(messages);
    const input = convertMessagesToInteractionsInput(messages, mediaResolution);

    const body: Gemini.Interactions.CreateInteractionParameters = {
      ...this.invocationParams(options),
      stream: true,
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      input,
    };

    const url = await this.buildUrl("interactions?alt=sse");
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
      const eventStream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .pipeThrough(
          new SafeJsonEventParserStream<Gemini.Interactions.InteractionSseEvent>()
        );

      async function* sseEvents(
        stream: ReadableStream<Gemini.Interactions.InteractionSseEvent | null>,
        signal?: AbortSignal
      ): AsyncGenerator<Gemini.Interactions.InteractionSseEvent> {
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
            await runManager?.handleCustomEvent(`google-chunk-${moduleName}`, {
              chunk: value,
            });
            if (value !== null) {
              yield value;
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      for await (const chunk of convertInteractionsStreamToChunks(
        sseEvents(eventStream, options?.signal),
        {
          streamUsage,
          model: this.params.model,
        }
      )) {
        yield chunk;
        await runManager?.handleLLMNewToken(
          chunk.text ?? "",
          undefined,
          undefined,
          undefined,
          undefined,
          { chunk }
        );
      }
    }
  }

  async *streamChatModelEvents(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent> {
    const fields = combineInteractionsFields(this.params, options ?? {});
    const mediaResolution = convertMediaResolutionToInteractions(
      fields.mediaResolution,
      fields.detail
    );
    const systemInstruction =
      convertMessagesToInteractionsSystemInstruction(messages);
    const input = convertMessagesToInteractionsInput(messages, mediaResolution);

    const body: Gemini.Interactions.CreateInteractionParameters = {
      ...this.invocationParams(options),
      stream: true,
      ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
      input,
    };

    const url = await this.buildUrl("interactions?alt=sse");
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
        new SafeJsonEventParserStream<Gemini.Interactions.InteractionSseEvent>()
      );

    const shouldStreamUsage =
      this.params.streamUsage !== false && options?.streamUsage !== false;

    async function* sseEvents(
      stream: ReadableStream<Gemini.Interactions.InteractionSseEvent | null>,
      signal?: AbortSignal
    ): AsyncGenerator<Gemini.Interactions.InteractionSseEvent> {
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

    yield* convertInteractionsStream(sseEvents(eventStream, options?.signal), {
      streamUsage: shouldStreamUsage,
      model: this.params.model,
    });
  }

  invocationParams(
    options?: BaseChatGoogleCallOptions
  ): InteractionsInvocationParams {
    const fields = combineInteractionsFields(this.params, options ?? {});

    const tools = fields.tools
      ? convertToolsToInteractionsTools(fields.tools)
      : undefined;

    const toolChoice = convertToolChoiceToInteractionsConfig(
      options?.tool_choice,
      !!(tools && tools.length > 0)
    );

    const thinking = convertFieldsToInteractionsThinking(
      this.params.model,
      fields
    );
    const speechConfig = convertFieldsToInteractionsSpeechConfig(fields);
    const imageConfig = convertFieldsToInteractionsImageConfig(
      fields.imageConfig
    );
    const responseFormat = convertFieldsToInteractionsResponseFormat(fields);
    const responseModalities =
      convertFieldsToInteractionsResponseModalities(fields);
    const safetySettings = convertSafetySettingsToInteractions(
      fields.safetySettings
    );

    const responseMimeType =
      fields.responseMimeType ??
      (fields.responseSchema ? "application/json" : undefined);

    const generationConfig: Gemini.Interactions.GenerationConfig = {
      ...(fields.temperature !== undefined
        ? { temperature: fields.temperature }
        : {}),
      ...(fields.topP !== undefined ? { top_p: fields.topP } : {}),
      ...(fields.topK !== undefined ? { top_k: fields.topK } : {}),
      ...(fields.maxOutputTokens !== undefined
        ? { max_output_tokens: fields.maxOutputTokens }
        : {}),
      ...(fields.presencePenalty !== undefined
        ? { presence_penalty: fields.presencePenalty }
        : {}),
      ...(fields.frequencyPenalty !== undefined
        ? { frequency_penalty: fields.frequencyPenalty }
        : {}),
      ...(fields.stopSequences !== undefined
        ? { stop_sequences: fields.stopSequences }
        : {}),
      ...(fields.seed !== undefined ? { seed: fields.seed } : {}),
      ...(fields.responseLogprobs !== undefined
        ? { response_logprobs: fields.responseLogprobs }
        : {}),
      ...(fields.logprobs !== undefined ? { logprobs: fields.logprobs } : {}),
      ...thinking,
      ...(speechConfig ? { speech_config: speechConfig } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      ...(imageConfig
        ? {
            image_config: {
              type: "image",
              ...imageConfig,
            },
          }
        : {}),
    };

    const hasGenerationConfig = Object.keys(generationConfig).length > 0;

    return {
      ...(fields.agent
        ? {
            agent: fields.agent,
            ...(fields.agentConfig ? { agent_config: fields.agentConfig } : {}),
          }
        : { model: this.params.model }),
      ...(tools && tools.length > 0 ? { tools } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(responseMimeType ? { response_mime_type: responseMimeType } : {}),
      ...(responseModalities
        ? { response_modalities: responseModalities }
        : {}),
      ...(safetySettings ? { safety_settings: safetySettings } : {}),
      ...(hasGenerationConfig ? { generation_config: generationConfig } : {}),
      ...convertFieldsToInteractionsServiceTier(this.params.platform, fields),
      ...(fields.previousInteractionId
        ? { previous_interaction_id: fields.previousInteractionId }
        : {}),
      ...(fields.store !== undefined ? { store: fields.store } : {}),
      ...(fields.background !== undefined
        ? { background: fields.background }
        : {}),
      ...(fields.webhookConfig ? { webhook_config: fields.webhookConfig } : {}),
    };
  }

  formatStructuredOutputTool(
    schema: InteropZodType | SerializableSchema | Record<string, unknown>,
    options?: { name?: string; description?: string }
  ): { tools: BindToolsInput[]; toolChoice: string; functionName: string } {
    let functionName = options?.name ?? "extract";
    let interactionsFunctionTool: Gemini.Interactions.Function;

    if (isInteropZodSchema(schema) || isSerializableSchema(schema)) {
      const jsonSchema = schemaToGeminiParameters(schema);
      const description =
        options?.description ??
        (typeof jsonSchema.description === "string"
          ? jsonSchema.description
          : "A function available to call.");
      interactionsFunctionTool = {
        type: "function",
        name: functionName,
        description,
        parameters: jsonSchema as unknown as Record<string, unknown>,
      };
    } else if (
      typeof (schema as { name?: unknown }).name === "string" &&
      typeof (schema as { parameters?: unknown }).parameters === "object" &&
      (schema as { parameters?: unknown }).parameters != null
    ) {
      const raw = schema as {
        name: string;
        description?: string;
        parameters: Record<string, unknown>;
      };
      functionName = raw.name;
      interactionsFunctionTool = {
        type: "function",
        name: raw.name,
        description:
          options?.description ??
          raw.description ??
          "A function available to call.",
        parameters: raw.parameters,
      };
    } else {
      const parameters = schemaToGeminiParameters(schema);
      interactionsFunctionTool = {
        type: "function",
        name: functionName,
        description:
          options?.description ??
          (schema as { description?: string }).description ??
          "A function available to call.",
        parameters: parameters as unknown as Record<string, unknown>,
      };
    }

    return {
      tools: [interactionsFunctionTool],
      toolChoice: functionName,
      functionName,
    };
  }
}
