import { CohereClient } from "cohere-ai";

import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { CohereClientOptions, getCohereClient } from "./client.js";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the CohereEmbeddings class.
 */
export interface CohereEmbeddingsParams extends EmbeddingsParams {
  model?: string;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the Cohere API to a maximum of 96.
   */
  batchSize?: number;

  /**
   * Specifies the type of embeddings you want to generate.
   */
  embeddingTypes?: Array<string>;

  /**
   * Specifies the type of input you're giving to the model.
   * Not required for older versions of the embedding models (i.e. anything lower than v3),
   * but is required for more recent versions (i.e. anything bigger than v2).
   *
   * * `search_document` - Use this when you encode documents for embeddings that you store in a vector database for search use-cases.
   * * `search_query` - Use this when you query your vector DB to find relevant documents.
   * * `classification` - Use this when you use the embeddings as an input to a text classifier.
   * * `clustering` - Use this when you want to cluster the embeddings.
   */
  inputType?: string;
}

/**
 * A class for generating embeddings using the Cohere API.
 */
export class CohereEmbeddings
  extends Embeddings
  implements CohereEmbeddingsParams
{
  model: string | undefined;

  batchSize = 48;

  embeddingTypes = ["float"];

  private client: CohereClient;

  /**
   * Constructor for the CohereEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<CohereEmbeddingsParams> & {
      verbose?: boolean;
    } & CohereClientOptions
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

    super(fieldsWithDefaults);

    this.client = getCohereClient(fieldsWithDefaults);
    this.model = fieldsWithDefaults?.model ?? this.model;

    if (!this.model) {
      throw new Error(
        "Model not specified for CohereEmbeddings instance. Please provide a model name from the options here: https://docs.cohere.com/reference/embed"
      );
    }

    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.embeddingTypes =
      fieldsWithDefaults?.embeddingTypes ?? this.embeddingTypes;
  }

  /**
   * Generates embeddings for an array of texts.
   * @param texts - An array of strings to generate embeddings for.
   * @returns A Promise that resolves to an array of embeddings.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(texts, this.batchSize);

    const batchRequests = batches.map((batch) =>
      this.embeddingWithRetry({
        model: this.model,
        texts: batch,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputType: "search_document" as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeddingTypes: this.embeddingTypes as any,
      })
    );

    const batchResponses = await Promise.all(batchRequests);

    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const { embeddings: batchResponse } = batchResponses[i];
      for (let j = 0; j < batch.length; j += 1) {
        if ("float" in batchResponse && batchResponse.float) {
          embeddings.push(batchResponse.float[j]);
        } else if (Array.isArray(batchResponse)) {
          embeddings.push(batchResponse[j as number]);
        }
      }
    }

    return embeddings;
  }

  /**
   * Generates an embedding for a single text.
   * @param text - A string to generate an embedding for.
   * @returns A Promise that resolves to an array of numbers representing the embedding.
   */
  async embedQuery(text: string): Promise<number[]> {
    const { embeddings } = await this.embeddingWithRetry({
      model: this.model,
      texts: [text],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputType: "search_query" as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embeddingTypes: this.embeddingTypes as any,
    });
    if ("float" in embeddings && embeddings.float) {
      return embeddings.float[0];
    } else if (Array.isArray(embeddings)) {
      return embeddings[0];
    } else {
      throw new Error(
        `Invalid response from Cohere API. Received: ${JSON.stringify(
          embeddings,
          null,
          2
        )}`
      );
    }
  }

  async embed(
    request: Parameters<typeof this.client.embed>[0]
  ): Promise<number[]> {
    const { embeddings } = await this.embeddingWithRetry(request);
    if ("float" in embeddings && embeddings.float) {
      return embeddings.float[0];
    } else if (Array.isArray(embeddings)) {
      return embeddings[0];
    } else {
      throw new Error(
        `Invalid response from Cohere API. Received: ${JSON.stringify(
          embeddings,
          null,
          2
        )}`
      );
    }
  }

  /**
   * Generates embeddings with retry capabilities.
   * @param request - An object containing the request parameters for generating embeddings.
   * @returns A Promise that resolves to the API response.
   */
  private async embeddingWithRetry(
    request: Parameters<typeof this.client.embed>[0]
  ) {
    return this.caller.call(async () => {
      let response;
      try {
        response = await this.client.embed(request);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        e.status = e.status ?? e.statusCode;
        throw e;
      }
      return response;
    });
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "COHERE_API_KEY",
      api_key: "COHERE_API_KEY",
    };
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return {
      apiKey: "cohere_api_key",
      api_key: "cohere_api_key",
    };
  }
}
