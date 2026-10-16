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

  protected formatUrl(
    pathPrefix: string | string[],
    urlMethod?: string
  ): string {
    const rawPrefix = Array.isArray(pathPrefix)
      ? pathPrefix.join("/")
      : pathPrefix;
    const normalizedPrefix = rawPrefix.replace(/^\/+|\/+$/g, "");
    const prefixPath = normalizedPrefix ? `/${normalizedPrefix}` : "";

    const [suffixPath, query] = this.getUrlSuffix(urlMethod).split("?", 2);
    const url = new URL(this.endpointUrl);
    const basePath = url.pathname.replace(/\/+$/, "");
    url.pathname = `${basePath}/${this.params.apiVersion}${prefixPath}${suffixPath}`;
    if (query) {
      url.search = query;
    }
    return url.toString();
  }

  protected async buildUrlGemini(urlMethod?: string): Promise<string> {
    return this.formatUrl("", urlMethod);
  }

  protected async buildUrlVertexExpress(urlMethod?: string): Promise<string> {
    return this.formatUrl(
      [
        `publishers/${this.params.publisher}`,
      ],
      urlMethod
    );
  }

  protected async buildUrlVertexLocation(urlMethod?: string): Promise<string> {
    const projectId = await this.params.apiClient.getProjectId();
    return this.formatUrl(
      [
        `projects/${projectId}`,
        `locations/${this.params.location}`,
        `publishers/${this.params.publisher}`,
      ],
      urlMethod
    );
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

  abstract streamChatModelEvents(
    messages: BaseMessage[],
    options?: BaseChatGoogleCallOptions,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatModelStreamEvent>;
}
