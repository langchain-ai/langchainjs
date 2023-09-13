import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { AsyncCaller, AsyncCallerCallOptions } from "./async_caller.js";
import type {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
  GoogleVertexAILLMResponse,
  GoogleVertexAIModelParams,
  GoogleVertexAIResponse,
  GoogleVertexAIAbstractedClient,
} from "../types/googlevertexai-types.js";
import { ChatGenerationChunk, ChatMessage, BaseMessage } from "../schema/index.js";

export abstract class GoogleVertexAIConnection<
  CallOptions extends AsyncCallerCallOptions,
  ResponseType extends GoogleVertexAIResponse,
  AuthOptions
> implements GoogleVertexAIConnectionParams<AuthOptions>
{
  caller: AsyncCaller;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  apiVersion = "v1";

  client: GoogleVertexAIAbstractedClient;

  constructor(
    fields: GoogleVertexAIConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleVertexAIAbstractedClient
  ) {
    this.caller = caller;

    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.apiVersion = fields?.apiVersion ?? this.apiVersion;
    this.client = client;
  }

  abstract buildUrl(streaming?: boolean): Promise<string>;

  buildMethod(): string {
    return "POST";
  }

  async _request(
    data: unknown | undefined,
    options: CallOptions,
  ): Promise<ResponseType> {
    const url = await this.buildUrl(false);
    const method = this.buildMethod();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      url,
      method,
    };
    if (data && method === "POST") {
      opts.data = data;
    }

    try {
      const callResponse = await this.caller.callWithOptions(
        { signal: options?.signal },
        async () => this.client.request(opts)
      );
      const response: unknown = callResponse; // Done for typecast safety, I guess
      return <ResponseType>response;
    } catch (x) {
      throw x;
    }
  }

  async *_stream(
    data: unknown | undefined,
    options: CallOptions
  ): AsyncGenerator<ChatGenerationChunk> {
    const url = await this.buildUrl(true);
    console.log(data, url);
    const method = this.buildMethod();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts: any = {
      url,
      method,
    };
    if (data && method === "POST") {
      opts.data = data;
    }
    try {
      const stream = await this.caller.callWithOptions(
        { signal: options?.signal },
        async () => this.client.stream(opts)
      );
      for await (const chunk of stream) {
        // Transform to chat generation chunk
        yield chunk;
      }
    } catch (x) {
      throw x;
    }
  }
}

/**
 * Represents a single example exchange in the Google Vertex AI chat
 * model.
 */
interface GoogleVertexAIChatExample {
  input: GoogleVertexAIChatMessage;
  output: GoogleVertexAIChatMessage;
}

/**
 * Represents the author of a chat message in the Google Vertex AI chat
 * model.
 */
export type GoogleVertexAIChatAuthor =
  | "user" // Represents the human for Code and CodeChat models
  | "bot" // Represents the AI for Code models
  | "system" // Represents the AI for CodeChat models
  | "context"; // Represents contextual instructions

export type GoogleVertexAIChatMessageFields = {
  author?: GoogleVertexAIChatAuthor;
  content: string;
  name?: string;
};

/**
 * Represents a chat message in the Google Vertex AI chat model.
 */
export class GoogleVertexAIChatMessage {
  public author?: GoogleVertexAIChatAuthor;

  public content: string;

  public name?: string;

  constructor(fields: GoogleVertexAIChatMessageFields) {
    this.author = fields.author;
    this.content = fields.content;
    this.name = fields.name;
  }

  /**
   * Extracts the role of a generic message and maps it to a Google Vertex
   * AI chat author.
   * @param message The chat message to extract the role from.
   * @returns The role of the message mapped to a Google Vertex AI chat author.
   */
  static extractGenericMessageCustomRole(message: ChatMessage) {
    if (
      message.role !== "system" &&
      message.role !== "bot" &&
      message.role !== "user" &&
      message.role !== "context"
    ) {
      console.warn(`Unknown message role: ${message.role}`);
    }

    return message.role as GoogleVertexAIChatAuthor;
  }

  /**
   * Maps a message type to a Google Vertex AI chat author.
   * @param message The message to map.
   * @param model The model to use for mapping.
   * @returns The message type mapped to a Google Vertex AI chat author.
   */
  static mapMessageTypeToVertexChatAuthor(
    message: BaseMessage,
    model: string
  ): GoogleVertexAIChatAuthor {
    const type = message._getType();
    switch (type) {
      case "ai":
        return model.startsWith("codechat-") ? "system" : "bot";
      case "human":
        return "user";
      case "system":
        throw new Error(
          `System messages are only supported as the first passed message for Google Vertex AI.`
        );
      case "generic": {
        if (!ChatMessage.isInstance(message))
          throw new Error("Invalid generic chat message");
        return GoogleVertexAIChatMessage.extractGenericMessageCustomRole(
          message
        );
      }
      default:
        throw new Error(`Unknown / unsupported message type: ${message}`);
    }
  }

  /**
   * Creates a new Google Vertex AI chat message from a base message.
   * @param message The base message to convert.
   * @param model The model to use for conversion.
   * @returns A new Google Vertex AI chat message.
   */
  static fromChatMessage(message: BaseMessage, model: string) {
    return new GoogleVertexAIChatMessage({
      author: GoogleVertexAIChatMessage.mapMessageTypeToVertexChatAuthor(
        message,
        model
      ),
      content: message.content,
    });
  }
}

/**
 * Represents an instance of the Google Vertex AI chat model.
 */
export interface GoogleVertexAIChatInstance {
  context?: string;
  examples?: GoogleVertexAIChatExample[];
  messages: GoogleVertexAIChatMessage[];
}


export class GoogleVertexAILLMConnection<
    CallOptions extends BaseLanguageModelCallOptions,
    InstanceType extends GoogleVertexAIChatInstance,
    PredictionType extends GoogleVertexAIBasePrediction,
    AuthOptions
  >
  extends GoogleVertexAIConnection<CallOptions, PredictionType, AuthOptions>
  implements GoogleVertexAIBaseLLMInput<AuthOptions>
{
  model: string;

  client: GoogleVertexAIAbstractedClient;

  constructor(
    fields: GoogleVertexAIBaseLLMInput<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleVertexAIAbstractedClient
  ) {
    super(fields, caller, client);
    this.client = client;
    this.model = fields?.model ?? this.model;
  }

  async buildUrl(streaming?: boolean): Promise<string> {
    const projectId = await this.client.getProjectId();
    if (streaming) {
      return `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:serverStreamingPredict`;
    } else {
      return `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:predict`;
    }
  }

  async request(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams,
    options: CallOptions
  ): Promise<GoogleVertexAILLMResponse<PredictionType>> {
    const data = {
      instances,
      parameters,
    };
    const response = await this._request(data, options);
    return response;
  }

  protected _formatStreamInstances(instances: InstanceType[]) {
    return instances.map((instance) => {
      if (instance.messages) {
        return {
          struct_val: {
            messages: {
              list_val: instance.messages.map((message) => {
                const structVal: Record<string, unknown> = {
                  content: {
                    string_val: [message.content]
                  }
                };
                if (message.author !== undefined) {
                  structVal.author = {
                    string_val: [message.author]
                  };
                }
                if (message.name !== undefined) {
                  structVal.name = {
                    string_val: [message.name]
                  };
                }
                return { struct_val: structVal }
              })
            }
          }
        };
      } else {
        return {};
      }
    });
  }

  protected _formatStreamParameters(params: GoogleVertexAIModelParams) {
    const structVal: Record<string, unknown> = {};
    if (params.temperature !== undefined) {
      structVal.temperature = { float_val: params.temperature }
    }
    if (params.maxOutputTokens !== undefined) {
      structVal.maxOutputTokens = { int_val: params.maxOutputTokens };
    }
    if (params.topK !== undefined) {
      structVal.topK = { int_val: params.topK };
    }
    if (params.topP !== undefined) {
      structVal.topP = { float_val: params.topP };
    }
    return { struct_val: structVal };
  }

  async *stream(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams,
    options: CallOptions
  ) {
    console.log(instances);
    // From https://cloud.google.com/vertex-ai/docs/generative-ai/learn/streaming#rest
    const data = {
      inputs: this._formatStreamInstances(instances),
      parameters: this._formatStreamParameters(parameters),
    };
    yield *this._stream(data, options);
  }
}
