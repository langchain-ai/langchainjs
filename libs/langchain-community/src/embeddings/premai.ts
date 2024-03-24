import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import Prem from "@premai/prem-sdk";

/**
 * Interface for PremEmbeddings parameters. Extends EmbeddingsParams and
 * defines additional parameters specific to the PremEmbeddings class.
 */
export interface PremEmbeddingsParams extends EmbeddingsParams {
  /**
   * The Prem API key to use for requests.
   * @default process.env.PREM_API_KEY
   */
  apiKey?: string;

  baseUrl?: string;

  /**
   * The ID of the project to use.
   */
  project_id?: number | string;
  /**
   * The model to generate the embeddings.
   */
  model: string;

  encoding_format?: ("float" | "base64") & string;

  batchSize?: number;
}

/**
 * Class for generating embeddings using the Prem AI's API. Extends the
 * Embeddings class and implements PremEmbeddingsParams and
 */
export class PremEmbeddings extends Embeddings implements PremEmbeddingsParams {
  client: Prem;

  batchSize = 128;

  apiKey?: string;

  project_id: number;

  model: string;

  encoding_format?: ("float" | "base64") & string;

  constructor(fields: PremEmbeddingsParams) {
    super(fields);
    const apiKey = fields?.apiKey || getEnvironmentVariable("PREM_API_KEY");
    if (!apiKey) {
      throw new Error(
        `Prem API key not found. Please set the PREM_API_KEY environment variable or provide the key into "apiKey"`
      );
    }

    const projectId =
      fields?.project_id ??
      parseInt(getEnvironmentVariable("PREM_PROJECT_ID") ?? "-1", 10);
    if (!projectId || projectId === -1 || typeof projectId !== "number") {
      throw new Error(
        `Prem project ID not found. Please set the PREM_PROJECT_ID environment variable or provide the key into "project_id"`
      );
    }

    this.client = new Prem({
      apiKey,
    });
    this.project_id = projectId;
    this.model = fields.model ?? this.model;
    this.encoding_format = fields.encoding_format ?? this.encoding_format;
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the Prem API to generate
   * embeddings.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const mappedTexts = texts.map((text) => text);

    const batches = chunkArray(mappedTexts, this.batchSize);

    const batchRequests = batches.map((batch) =>
      this.caller.call(async () =>
        this.client.embeddings.create({
          input: batch,
          model: this.model,
          encoding_format: this.encoding_format,
          project_id: this.project_id,
        })
      )
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
   * embedDocuments method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const data = await this.embedDocuments([text]);
    return data[0];
  }
}
