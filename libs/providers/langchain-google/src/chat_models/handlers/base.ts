import type { BaseMessage } from "@langchain/core/messages";
import type { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { BindToolsInput } from "@langchain/core/language_models/chat_models";
import type { ChatModelStreamEvent } from "@langchain/core/language_models/event";
import type { InteropZodType } from "@langchain/core/utils/types";
import type { SerializableSchema } from "@langchain/core/utils/standard_schema";
import type {
  BaseChatGoogleCallOptions,
  GoogleChatApiHandlerParams,
  GooglePlatformType,
} from "../types.js";

/**
 * Base abstract handler for Google Chat wire protocols.
 *
 * Encapsulates wire-level concerns (URL construction, HTTP payload serialization,
 * response/stream parsing, and custom event logging) away from the BaseChatGoogle facade.
 */
export abstract class GoogleChatApiHandler<
  TInvocationParams extends object = Record<string, unknown>,
  TParams extends GoogleChatApiHandlerParams = GoogleChatApiHandlerParams,
> {
  protected params: TParams;

  constructor(params: TParams) {
    this.params = params;
  }

  get platform(): GooglePlatformType {
    return this.params.platform;
  }

  protected get endpointUrl(): string {
    return this.params.endpoint.includes("://")
      ? this.params.endpoint
      : `https://${this.params.endpoint}`;
  }

  /**
   * The protocol-specific path suffix appended to the base URL:
   * - GenerateContent: `/models/${this.params.model}:${urlMethod ?? this.urlMethod}`
   * - Interactions (Phase 2): `/interactions` (or `/interactions?alt=sse`)
   */
  protected abstract getUrlSuffix(urlMethod?: string): string;

  protected async buildUrlGemini(urlMethod?: string): Promise<string> {
    return `${this.endpointUrl}/${this.params.apiVersion}${this.getUrlSuffix(urlMethod)}`;
  }

  protected async buildUrlVertexExpress(urlMethod?: string): Promise<string> {
    return `${this.endpointUrl}/${this.params.apiVersion}/publishers/${
      this.params.publisher
    }${this.getUrlSuffix(urlMethod)}`;
  }

  protected async buildUrlVertexLocation(urlMethod?: string): Promise<string> {
    const projectId = await this.params.apiClient.getProjectId();
    return `${this.endpointUrl}/${
      this.params.apiVersion
    }/projects/${projectId}/locations/${this.params.location}/publishers/${
      this.params.publisher
    }${this.getUrlSuffix(urlMethod)}`;
  }

  protected async buildUrlVertex(urlMethod?: string): Promise<string> {
    if (this.params.isVertexExpress) {
      return this.buildUrlVertexExpress(urlMethod);
    } else {
      return this.buildUrlVertexLocation(urlMethod);
    }
  }

  async buildUrl(urlMethod?: string): Promise<string> {
    switch (this.params.platform) {
      case "gai":
        return this.buildUrlGemini(urlMethod);
      default:
        return this.buildUrlVertex(urlMethod);
    }
  }

  getHeaders(options?: BaseChatGoogleCallOptions): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...this.params.customHeaders,
      ...options?.customHeaders,
    };
  }

  abstract generate(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult>;

  abstract streamResponseChunks(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk>;

  abstract invocationParams(
    options?: BaseChatGoogleCallOptions
  ): TInvocationParams;

  abstract formatStructuredOutputTool(
    schema: InteropZodType | SerializableSchema | Record<string, unknown>,
    options?: { name?: string; description?: string }
  ): { tools: BindToolsInput[]; toolChoice: string; functionName: string };

  streamChatModelEvents?(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent>;
}
