import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import MistralClient, {
  type EmbeddingsResult as MistralAIEmbeddingsResult,
} from "@mistralai/mistralai";

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
   * @default {"mistral-embed"}
   */
  modelName?: string;
  /**
   * The format of the output data.
   * @default {"float"}
   */
  encodingFormat?: string;
  /**
   * Override the default endpoint.
   */
  endpoint?: string;
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
}

export const chunkArray = <T>(arr: T[], chunkSize: number) =>
  arr.reduce((chunks, elem, index) => {
    const chunkIndex = Math.floor(index / chunkSize);
    const chunk = chunks[chunkIndex] || [];
    // eslint-disable-next-line no-param-reassign
    chunks[chunkIndex] = chunk.concat([elem]);
    return chunks;
  }, [] as T[][]);

/**
 * Class for generating embeddings using the MistralAI API.
 */
export class MistralAIEmbeddings
  extends Embeddings
  implements MistralAIEmbeddingsParams
{
  client = new MistralClient();

  modelName = "mistral-embed";

  encodingFormat = "float";

  batchSize = 512;

  stripNewLines = true;

  constructor(fields?: Partial<MistralAIEmbeddingsParams>) {
    super(fields ?? {});
    const apiKey = fields?.apiKey ?? getEnvironmentVariable("MISTRAL_API_KEY");
    if (!apiKey) {
      throw new Error("API key missing for MistralAI, but it is required.");
    }
    this.client = new MistralClient(apiKey, fields?.endpoint);
    this.modelName = fields?.modelName ?? this.modelName;
    this.encodingFormat = fields?.encodingFormat ?? this.encodingFormat;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
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
        embeddings.push(batchResponse[j].embedding);
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
    return data[0].embedding;
  }

  /**
   * Private method to make a request to the MistralAI API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param {string | Array<string>} input Text to send to the MistralAI API.
   * @returns {Promise<MistralAIEmbeddingsResult>} Promise that resolves to the response from the API.
   */
  private async embeddingWithRetry(
    input: string | Array<string>
  ): Promise<MistralAIEmbeddingsResult> {
    return this.caller.call(async () => {
      const res = await this.client.embeddings({
        model: this.modelName,
        input,
      });
      return res;
    });
  }
}
