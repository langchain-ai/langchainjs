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

  get endpoint(): string {
    if (this.params.endpoint) {
      return this.params.endpoint;
    }
    if (this.params.baseUrl) {
      return this.params.baseUrl;
    }
    if (this.params.platform === "gai") {
      return "generativelanguage.googleapis.com";
    }
    if (this.params.isVertexExpress || this.location === "global") {
      return "aiplatform.googleapis.com";
    }
    if (!this.location.includes("-")) {
      return `aiplatform.${this.location}.rep.googleapis.com`;
    }
    return `${this.location}-aiplatform.googleapis.com`;
  }

  protected get endpointUrl(): string {
    return this.endpoint.includes("://")
      ? this.endpoint
      : `https://${this.endpoint}`;
  }

  get apiVersion(): string {
    return (
      this.params.apiVersion ??
      (this.params.platform === "gai" ? "v1beta" : "v1")
    );
  }

  get location(): string {
    return this.params.location ?? "us-central1";
  }

  get publisher(): string {
    return this.params.publisher ?? "google";
  }

  /**
   * The protocol-specific path suffix appended to the base URL:
   * - GenerateContent: `/models/${this.params.model}:${urlMethod ?? this.urlMethod}`
   * - Interactions (Phase 2): `/interactions` (or `/interactions?alt=sse`)
   */
  protected abstract getUrlSuffix(urlMethod?: string): string;

  protected async buildUrlGemini(urlMethod?: string): Promise<string> {
    const url = this.endpoint.includes("://")
      ? new URL(this.endpoint)
      : new URL(`https://${this.endpoint}`);
    const suffix = this.getUrlSuffix(urlMethod);
    const [pathPart, search] = suffix.split("?", 2);
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/${this.apiVersion}${pathPart}`;
    if (search) {
      url.search = search;
    }
    return url.toString();
  }

  protected async buildUrlVertexExpress(urlMethod?: string): Promise<string> {
    return `${this.endpointUrl}/${this.apiVersion}/publishers/${
      this.publisher
    }${this.getUrlSuffix(urlMethod)}`;
  }

  protected async buildUrlVertexLocation(urlMethod?: string): Promise<string> {
    const projectId =
      this.params.project ?? (await this.params.apiClient.getProjectId());
    return `${this.endpointUrl}/${
      this.apiVersion
    }/projects/${projectId}/locations/${this.location}/publishers/${
      this.publisher
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

  abstract streamChatModelEvents?(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent>;
}
