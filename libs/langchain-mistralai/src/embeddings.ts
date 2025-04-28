import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { EmbeddingRequest as MistralAIEmbeddingsRequest } from "@mistralai/mistralai/src/models/components/embeddingrequest.js";
import { EmbeddingResponse as MistralAIEmbeddingsResponse } from "@mistralai/mistralai/src/models/components/embeddingresponse.js";
import {
  BeforeRequestHook,
  RequestErrorHook,
  ResponseHook,
  HTTPClient as MistralAIHTTPClient,
} from "@mistralai/mistralai/lib/http.js";

/**
 * Interface for MistralAIEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the MistralAIEmbeddings class.
 */
export interface MistralAIEmbeddingsParams extends EmbeddingsParams {
  /**
   * The API key to use.
   * @default {process.env.MISTRAL_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * Alias for `model`.
   * @default {"mistral-embed"}
   */
  modelName?: string;
  /**
   * The name of the model to use.
   * @default {"mistral-embed"}
   */
  model?: string;
  /**
   * The format of the output data.
   * @default {"float"}
   */
  encodingFormat?: string;
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
   * The maximum number of documents to embed in a single request.
   * @default {512}
   */
  batchSize?: number;
  /**
   * Whether to strip new lines from the input text. This is recommended,
   * but may not be suitable for all use cases.
   * @default {true}
   */
  stripNewLines?: boolean;
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
}

/**
 * Class for generating embeddings using the MistralAI API.
 */
export class MistralAIEmbeddings
  extends Embeddings
  implements MistralAIEmbeddingsParams
{
  modelName = "mistral-embed";

  model = "mistral-embed";

  encodingFormat = "float";

  batchSize = 512;

  stripNewLines = true;

  apiKey: string;

  /**
   * @deprecated use serverURL instead
   */
  endpoint: string;

  serverURL?: string;

  beforeRequestHooks?: Array<BeforeRequestHook>;

  requestErrorHooks?: Array<RequestErrorHook>;

  responseHooks?: Array<ResponseHook>;

  httpClient?: MistralAIHTTPClient;

  constructor(fields?: Partial<MistralAIEmbeddingsParams>) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("MISTRAL_API_KEY");
    if (!apiKey) {
      throw new Error("API key missing for MistralAI, but it is required.");
    }
    this.apiKey = apiKey;
    this.serverURL = fields?.serverURL ?? this.serverURL;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.encodingFormat = fields?.encodingFormat ?? this.encodingFormat;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.beforeRequestHooks =
      fields?.beforeRequestHooks ?? this.beforeRequestHooks;
    this.requestErrorHooks =
      fields?.requestErrorHooks ?? this.requestErrorHooks;
    this.responseHooks = fields?.responseHooks ?? this.responseHooks;
    this.httpClient = fields?.httpClient ?? this.httpClient;
    this.addAllHooksToHttpClient();
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the MistralAI API to generate
   * embeddings.
   * @param {Array<string>} texts Array of documents to generate embeddings for.
   * @returns {Promise<number[][]>} Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const batchRequests = batches.map((batch) =>
      this.embeddingWithRetry(batch)
    );
    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];
    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { data: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(batchResponse[j].embedding ?? []);
      }
    }
    return embeddings;
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embeddingWithRetry method with the document as the input.
   * @param {string} text Document to generate an embedding for.
   * @returns {Promise<number[]>} Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry(
      this.stripNewLines ? text.replace(/\n/g, " ") : text
    );
    return data[0].embedding ?? [];
  }

  /**
   * Private method to make a request to the MistralAI API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param {string | Array<string>} inputs Text to send to the MistralAI API.
   * @returns {Promise<MistralAIEmbeddingsResponse>} Promise that resolves to the response from the API.
   */
  private async embeddingWithRetry(
    inputs: string | Array<string>
  ): Promise<MistralAIEmbeddingsResponse> {
    const { Mistral } = await this.imports();
    const client = new Mistral({
      apiKey: this.apiKey,
      serverURL: this.serverURL,
      // If httpClient exists, pass it into constructor
      ...(this.httpClient ? { httpClient: this.httpClient } : {}),
    });
    const embeddingsRequest: MistralAIEmbeddingsRequest = {
      model: this.model,
      inputs,
      encodingFormat: this.encodingFormat,
    };
    return this.caller.call(async () => {
      const res = await client.embeddings.create(embeddingsRequest);
      return res;
    });
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
