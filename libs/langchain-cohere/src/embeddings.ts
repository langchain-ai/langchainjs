import { CohereClient } from "cohere-ai";

import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

/**
 * Interface that extends EmbeddingsParams and defines additional
 * parameters specific to the CohereEmbeddings class.
 */
export interface CohereEmbeddingsParams extends EmbeddingsParams {
  model: string;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the Cohere API to a maximum of 96.
   */
  batchSize?: number;

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
  model = "small";

  batchSize = 48;

  inputType: string | undefined;

  private client: CohereClient;

  /**
   * Constructor for the CohereEmbeddings class.
   * @param fields - An optional object with properties to configure the instance.
   */
  constructor(
    fields?: Partial<CohereEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
    }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };

    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey || getEnvironmentVariable("COHERE_API_KEY");

    if (!apiKey) {
      throw new Error("Cohere API key not found");
    }

    this.client = new CohereClient({
      token: apiKey,
    });
    this.model = fieldsWithDefaults?.model ?? this.model;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.inputType = fieldsWithDefaults?.inputType;
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
        inputType: this.inputType,
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
