import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import {
  BaseChatModel,
  type LangSmithParams,
} from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Serialized } from "@langchain/core/load/serializable";

import type {
  ChatXAIResponsesCallOptions,
  ChatXAIResponsesInput,
  ChatXAIResponsesInvocationParams,
  XAIResponse,
  XAIResponsesCreateParams,
  XAIResponsesCreateParamsNonStreaming,
  XAIResponsesCreateParamsStreaming,
  XAIResponsesReasoning,
  XAIResponsesSearchParameters,
  XAIResponsesStreamEvent,
} from "./responses-types.js";

import {
  convertMessagesToResponsesInput,
  convertResponseToAIMessage,
  convertStreamEventToChunk,
  extractTextFromOutput,
} from "../converters/responses.js";

// Re-export types for convenience
export type {
  ChatXAIResponsesCallOptions,
  ChatXAIResponsesInput,
  ChatXAIResponsesInvocationParams,
};

// ============================================================================
// Main Class
// ============================================================================

/**
 * xAI Responses API chat model integration.
 *
 * This class provides access to xAI's Responses API, which offers enhanced
 * capabilities including built-in tools, reasoning, and search.
 *
 * @example
 * ```typescript
 * import { ChatXAIResponses } from "@langchain/xai";
 *
 * const llm = new ChatXAIResponses({
 *   model: "grok-3",
 *   temperature: 0.7,
 * });
 *
 * const result = await llm.invoke("What is the capital of France?");
 * console.log(result.content);
 * ```
 */
export class ChatXAIResponses<
  CallOptions extends ChatXAIResponsesCallOptions = ChatXAIResponsesCallOptions,
> extends BaseChatModel<CallOptions> {
  static lc_name() {
    return "ChatXAIResponses";
  }

  lc_serializable = true;

  lc_namespace = ["langchain", "chat_models", "xai"];

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "XAI_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "xai_api_key",
    };
  }

  // -------------------------------------------------------------------------
  // Instance Properties
  // -------------------------------------------------------------------------

  apiKey: string;

  model: string;

  streaming: boolean;

  temperature?: number;

  topP?: number;

  maxOutputTokens?: number;

  store?: boolean;

  user?: string;

  baseURL: string;

  searchParameters?: XAIResponsesSearchParameters;

  reasoning?: XAIResponsesReasoning;

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  constructor(fields?: ChatXAIResponsesInput) {
    super(fields ?? {});

    const apiKey = fields?.apiKey ?? getEnvironmentVariable("XAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        `xAI API key not found. Please set the XAI_API_KEY environment variable or provide the key in the "apiKey" field.`
      );
    }

    this.apiKey = apiKey;
    this.model = fields?.model ?? "grok-3";
    this.streaming = fields?.streaming ?? false;
    this.temperature = fields?.temperature;
    this.topP = fields?.topP;
    this.maxOutputTokens = fields?.maxOutputTokens;
    this.store = fields?.store;
    this.user = fields?.user;
    this.baseURL = fields?.baseURL ?? "https://api.x.ai/v1";
    this.searchParameters = fields?.searchParameters;
    this.reasoning = fields?.reasoning;
  }

  // -------------------------------------------------------------------------
  // Metadata Methods
  // -------------------------------------------------------------------------

  _llmType(): string {
    return "xai-responses";
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "xai";
    params.ls_model_name = this.model;
    params.ls_model_type = "chat";
    params.ls_temperature = this.temperature;
    params.ls_max_tokens = this.maxOutputTokens;
    return params;
  }

  override toJSON(): Serialized {
    const result = super.toJSON();

    if (
      "kwargs" in result &&
      typeof result.kwargs === "object" &&
      result.kwargs != null
    ) {
      delete (result.kwargs as Record<string, unknown>).apiKey;
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Invocation Params
  // -------------------------------------------------------------------------

  invocationParams(
    options?: this["ParsedCallOptions"]
  ): ChatXAIResponsesInvocationParams {
    return {
      model: this.model,
      temperature: this.temperature,
      top_p: this.topP,
      max_output_tokens: this.maxOutputTokens,
      store: this.store,
      user: this.user,
      stream: this.streaming,
      previous_response_id: options?.previous_response_id,
      include: options?.include,
      text: options?.text,
      search_parameters: options?.search_parameters ?? this.searchParameters,
      reasoning: options?.reasoning ?? this.reasoning,
      tool_choice: options?.tool_choice,
      parallel_tool_calls: options?.parallel_tool_calls,
    };
  }

  // -------------------------------------------------------------------------
  // API Call Methods
  // -------------------------------------------------------------------------

  /**
   * Makes a request to the xAI Responses API.
   */
  protected async _makeRequest(
    request: XAIResponsesCreateParamsNonStreaming
  ): Promise<XAIResponse>;

  protected async _makeRequest(
    request: XAIResponsesCreateParamsStreaming
  ): Promise<AsyncIterable<XAIResponsesStreamEvent>>;

  protected async _makeRequest(
    request: XAIResponsesCreateParams
  ): Promise<XAIResponse | AsyncIterable<XAIResponsesStreamEvent>> {
    const url = `${this.baseURL}/responses`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (request.stream) {
      return this._makeStreamingRequest(url, headers, request);
    }

    const response = await this.caller.call(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
          `xAI API error: ${res.status} ${res.statusText} - ${errorBody}`
        );
      }

      return res.json();
    });

    return response as XAIResponse;
  }

  /**
   * Makes a streaming request to the xAI Responses API.
   */
  protected async *_makeStreamingRequest(
    url: string,
    headers: Record<string, string>,
    request: XAIResponsesCreateParams
  ): AsyncIterable<XAIResponsesStreamEvent> {
    const response = await this.caller.call(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(
          `xAI API error: ${res.status} ${res.statusText} - ${errorBody}`
        );
      }

      return res;
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              yield data as XAIResponsesStreamEvent;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // -------------------------------------------------------------------------
  // Generation Methods
  // -------------------------------------------------------------------------

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const invocationParams = this.invocationParams(options);
    const input = convertMessagesToResponsesInput(messages);

    if (invocationParams.stream) {
      const stream = this._streamResponseChunks(messages, options, runManager);
      let finalChunk: ChatGenerationChunk | undefined;

      for await (const chunk of stream) {
        chunk.message.response_metadata = {
          ...chunk.generationInfo,
          ...chunk.message.response_metadata,
        };
        finalChunk = finalChunk?.concat(chunk) ?? chunk;
      }

      return {
        generations: finalChunk ? [finalChunk] : [],
        llmOutput: {
          estimatedTokenUsage: (finalChunk?.message as AIMessage | undefined)
            ?.usage_metadata,
        },
      };
    }

    const response = await this._makeRequest({
      input,
      ...invocationParams,
      stream: false,
    } as XAIResponsesCreateParamsNonStreaming);

    const aiMessage = convertResponseToAIMessage(response);
    const text = extractTextFromOutput(response.output);

    return {
      generations: [
        {
          text,
          message: aiMessage,
        },
      ],
      llmOutput: {
        id: response.id,
        estimatedTokenUsage: response.usage
          ? {
              promptTokens: response.usage.input_tokens,
              completionTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      },
    };
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const invocationParams = this.invocationParams(options);
    const input = convertMessagesToResponsesInput(messages);

    const streamIterable = await this._makeRequest({
      input,
      ...invocationParams,
      stream: true,
    } as XAIResponsesCreateParamsStreaming);

    for await (const event of streamIterable) {
      const chunk = convertStreamEventToChunk(event);
      if (chunk) {
        yield chunk;
        await runManager?.handleLLMNewToken(chunk.text || "", {
          prompt: 0,
          completion: 0,
        });
      }
    }
  }
}
