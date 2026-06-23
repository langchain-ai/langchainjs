import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the VoyageContextualizedEmbeddings class.
 *
 * Contextualized chunk embeddings (e.g. `voyage-context-4`) embed each chunk
 * **in the context of the other chunks from the same document**, capturing
 * both local chunk detail and global document-level semantics.
 *
 * Unlike standard Voyage embeddings, this uses the
 * `/v1/contextualizedembeddings` endpoint and a nested input format where
 * each inner list groups the chunks belonging to a single document.
 *
 * @see https://docs.voyageai.com/docs/contextualized-chunk-embeddings
 */
export interface VoyageContextualizedEmbeddingsParams extends EmbeddingsParams {
  modelName: string;

  /**
   * Base URL for Voyage API requests.
   * If your API key was created on the MongoDB Atlas UI, it should look like `'https://ai.mongodb.com/v1'`.
   * If your API key was created on the Voyage AI Dashboard, it should look like `'https://api.voyageai.com/v1'`.
   * @default "https://api.voyageai.com/v1"
   * @see https://www.mongodb.com/docs/voyageai/management/api-keys/?client-curl-default=curl#create-an-api-key
   */
  basePath?: string;

  /**
   * Input type for the embeddings request. Can be "query" or "document".
   */
  inputType?: string;

  /**
   * The desired dimension of the output embeddings.
   * For `voyage-context-4` this can be 256, 512, 1024 (default), or 2048.
   */
  outputDimension?: number;

  /**
   * The data type of the output embeddings. Can be "float" (default), "int8",
   * "uint8", "binary", or "ubinary".
   */
  outputDtype?: string;

  /**
   * The format of the output embeddings. Can be "float" or "base64".
   */
  encodingFormat?: string;
}

/**
 * Interface for the request body sent to the contextualized embeddings
 * endpoint.
 */
export interface CreateVoyageContextualizedEmbeddingRequest {
  /**
   * The model to use, e.g. `voyage-context-4`.
   */
  model: string;

  /**
   * Nested list of inputs. Each inner list groups the chunks that belong to a
   * single document, so that each chunk is embedded in the context of the
   * others.
   */
  input: string[][];

  /**
   * Input type for the embeddings request. Can be "query" or "document".
   */
  input_type?: string;

  /**
   * The desired dimension of the output embeddings.
   */
  output_dimension?: number;

  /**
   * The data type of the output embeddings.
   */
  output_dtype?: string;

  /**
   * The format of the output embeddings.
   */
  encoding_format?: string;
}

/**
 * A single chunk embedding returned by the contextualized embeddings endpoint.
 */
interface VoyageContextualizedEmbeddingItem {
  object: "embedding";
  embedding: number[];
  index: number;
}

/**
 * The shape of a successful response from the Voyage AI contextualized
 * embeddings endpoint. The top-level `data` array contains one entry per
 * input document, and each entry contains the embeddings for that document's
 * chunks.
 * @see https://docs.voyageai.com/reference/contextualized-embeddings-api
 */
interface VoyageContextualizedEmbeddingResponse {
  object: "list";
  data: Array<{
    object: "list";
    data: VoyageContextualizedEmbeddingItem[];
    index: number;
  }>;
  model: string;
  usage: { total_tokens: number };
}

function extractErrorMessage(body: unknown): string {
  if (typeof body === "object" && body !== null) {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    const err = b.error;
    if (
      typeof err === "object" &&
      err !== null &&
      typeof (err as Record<string, unknown>).message === "string"
    ) {
      return (err as Record<string, unknown>).message as string;
    }
    return JSON.stringify(body);
  }
  return `Unknown error: ${String(body)}`;
}

/**
 * A class for generating contextualized chunk embeddings using the Voyage AI
 * API (e.g. the `voyage-context-4` model).
 *
 * In addition to the standard {@link Embeddings} methods (`embedQuery` and
 * `embedDocuments`, where each text is treated as a standalone single-chunk
 * document), this class exposes {@link embedDocumentChunks} for the
 * contextualized use case, where you pass the chunks of each document grouped
 * together and receive one embedding per chunk that is aware of the rest of
 * the document.
 */
export class VoyageContextualizedEmbeddings
  extends Embeddings
  implements VoyageContextualizedEmbeddingsParams
{
  modelName = "voyage-context-4";

  private apiKey: string;

  /** Do not modify directly. Pass in the basePath option to the constructor. */
  basePath?: string = "https://api.voyageai.com/v1";

  apiUrl: string;

  headers?: Record<string, string>;

  inputType?: string;

  outputDimension?: number;

  outputDtype?: string;

  encodingFormat?: string;

  /**
   * Constructor for the VoyageContextualizedEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<VoyageContextualizedEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
      inputType?: string;
      basePath?: string;
    }
  ) {
    const fieldsWithDefaults = { ...fields };

    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey ??
      getEnvironmentVariable("VOYAGE_API_KEY") ??
      getEnvironmentVariable("VOYAGEAI_API_KEY");

    if (!apiKey) {
      throw new Error("Voyage AI API key not found");
    }

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.apiKey = apiKey;
    this.basePath = fieldsWithDefaults?.basePath ?? this.basePath;
    this.apiUrl = `${this.basePath}/contextualizedembeddings`;
    this.inputType = fieldsWithDefaults?.inputType;
    this.outputDimension = fieldsWithDefaults?.outputDimension;
    this.outputDtype = fieldsWithDefaults?.outputDtype;
    this.encodingFormat = fieldsWithDefaults?.encodingFormat;
  }

  /**
   * Generates embeddings for an array of texts, treating each text as a
   * standalone single-chunk document.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings, one per text.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const grouped = await this.embedDocumentChunks(
      texts.map((text) => [text]),
      this.inputType ?? "document"
    );

    // Each document has exactly one chunk, so flatten to one embedding per text.
    return grouped.map((chunks) => chunks[0]);
  }

  /**
   * Generates an embedding for a single query text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to the embedding vector.
   */
  async embedQuery(text: string): Promise<number[]> {
    const grouped = await this.embedDocumentChunks(
      [[text]],
      this.inputType ?? "query"
    );

    return grouped[0][0];
  }

  /**
   * Generates contextualized embeddings for a set of documents, where each
   * document is provided as a list of its chunks. Every chunk is embedded in
   * the context of the other chunks from the same document.
   * @param documents - A nested array; each inner array is the chunks of one document.
   * @param inputType - Optional override for the request input type.
   * @returns A Promise that resolves to a nested array of embeddings, mirroring
   *   the input structure: one embedding per chunk, grouped per document.
   */
  async embedDocumentChunks(
    documents: string[][],
    inputType?: string
  ): Promise<number[][][]> {
    const response = await this.embeddingWithRetry({
      model: this.modelName,
      input: documents,
      input_type: inputType ?? this.inputType,
      output_dimension: this.outputDimension,
      output_dtype: this.outputDtype,
      encoding_format: this.encodingFormat,
    });

    return response.data.map((doc) => doc.data.map((chunk) => chunk.embedding));
  }

  /**
   * Makes a request to the Voyage AI contextualized embeddings endpoint.
   * @param request - An object with properties to configure the request.
   * @returns A Promise that resolves to the response from the Voyage AI API.
   */
  private async embeddingWithRetry(
    request: CreateVoyageContextualizedEmbeddingRequest
  ): Promise<VoyageContextualizedEmbeddingResponse> {
    const makeCompletionRequest = async () => {
      const url = `${this.apiUrl}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          ...this.headers,
        },
        body: JSON.stringify(request),
      });

      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        console.error("Failed to parse JSON response:", error);
        json = null;
      }

      if (!response.ok) {
        const message = extractErrorMessage(json);
        const err = new Error(
          `Voyage AI API error (HTTP ${response.status}): ${message}`
        );
        // Attach status so AsyncCaller's defaultFailedAttemptHandler can
        // skip retries for non-transient HTTP errors (4xx).
        (err as NodeJS.ErrnoException & { status: number }).status =
          response.status;
        throw err;
      }

      return json as VoyageContextualizedEmbeddingResponse;
    };

    return this.caller.call(makeCompletionRequest);
  }
}
