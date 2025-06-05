import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { AtlasUser } from "@nomic-ai/atlas";

export type EmbeddingTaskType =
  | "search_query"
  | "search_document"
  | "clustering"
  | "classification";

/**
 * Interface for NomicEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the NomicEmbeddings class.
 */
export interface NomicEmbeddingsParams extends EmbeddingsParams {
  /**
   * The API key to use.
   * @default {process.env.NOMIC_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * Alias for `model`
   * @default {"nomic-embed-text-v1"}
   */
  modelName?: string;
  /**
   * The name of the model to use.
   * @default {"nomic-embed-text-v1"}
   */
  model?: string;
  /**
   * The task your embeddings should be specialized for:
   * search_query, search_document, clustering, classification.
   * @default {"search_document"}
   */
  taskType?: EmbeddingTaskType;
  /**
   * The maximum number of documents to embed in a single request.
   * @default {400}
   */
  batchSize?: number;
  /**
   * Whether to strip new lines from the input text. This is recommended,
   * but may not be suitable for all use cases.
   * @default {true}
   */
  stripNewLines?: boolean;
  /**
   * The output size of the embedding model. Applicable only to models
   * that support variable dimensionality and defaults to the models
   * largest embedding size.
   */
  dimensionality?: number;
}

export interface NomicEmbeddingsResult {
  embeddings: Array<number[]>;
  usage: {
    total_tokens: number;
  };
}

/**
 * Class for generating embeddings using the Nomic API.
 */
export class NomicEmbeddings
  extends Embeddings
  implements NomicEmbeddingsParams
{
  modelName = "nomic-embed-text-v1";

  model = "nomic-embed-text-v1";

  taskType: EmbeddingTaskType = "search_document";

  batchSize = 400;

  stripNewLines = true;

  client: AtlasUser;

  dimensionality?: number;

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      promptLayerApiKey: "NOMIC_API_KEY",
    };
  }

  constructor(fields?: Partial<NomicEmbeddingsParams>) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("NOMIC_API_KEY");
    if (!apiKey) {
      throw new Error("NOMIC_API_KEY is required.");
    }
    this.client = new AtlasUser({ apiKey });
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.taskType = fields?.taskType ?? this.taskType;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.dimensionality = fields?.dimensionality;
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the Nomic API to generate
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
    const embeddings = batchResponses
      .map(({ embeddings }) => embeddings)
      .flat();
    return embeddings;
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embeddingWithRetry method with the document as the input.
   * @param {string} text Document to generate an embedding for.
   * @returns {Promise<number[]>} Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { embeddings } = await this.embeddingWithRetry(
      this.stripNewLines ? text.replace(/\n/g, " ") : text
    );
    return embeddings[0];
  }

  /**
   * Private method to make a request to the Nomic API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param {string | Array<string>} input Text to send to the Nomic API.
   * @returns {Promise<NomicEmbeddingsResult>} Promise that resolves to the response from the API.
   */
  private async embeddingWithRetry(
    input: string | Array<string>
  ): Promise<NomicEmbeddingsResult> {
    return this.caller.call(async () => {
      const result = await this.client.apiCall(`/v1/embedding/text`, "POST", {
        model: this.model,
        texts: Array.isArray(input) ? input : [input],
        task_type: this.taskType,
        dimensionality: this.dimensionality,
      });
      return result as NomicEmbeddingsResult;
    });
  }
}
