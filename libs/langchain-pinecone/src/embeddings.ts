/* eslint-disable arrow-body-style */

import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import {
  EmbeddingsList,
  Pinecone,
  PineconeConfiguration,
} from "@pinecone-database/pinecone";
import { getPineconeClient } from "./client.js";

/* PineconeEmbeddingsParams holds the optional fields a user can pass to a Pinecone embedding model.
 * @param model - Model to use to generate embeddings. Default is "multilingual-e5-large".
 * @param params - Additional parameters to pass to the embedding model. Note: parameters are model-specific. Read
 *  more about model-specific parameters in the [Pinecone
 *  documentation](https://docs.pinecone.io/guides/inference/understanding-inference#model-specific-parameters).
 * */
export interface PineconeEmbeddingsParams extends EmbeddingsParams {
  model?: string; // Model to use to generate embeddings
  params?: Record<string, string>; // Additional parameters to pass to the embedding model
}

/* PineconeEmbeddings generates embeddings using the Pinecone Inference API. */
export class PineconeEmbeddings
  extends Embeddings
  implements PineconeEmbeddingsParams
{
  client: Pinecone;

  model: string;

  params: Record<string, string>;

  constructor(
    fields?: Partial<PineconeEmbeddingsParams> & Partial<PineconeConfiguration>
  ) {
    const defaultFields = { maxRetries: 3, ...fields };
    super(defaultFields);

    if (defaultFields.apiKey) {
      const config = {
        apiKey: defaultFields.apiKey,
        controllerHostUrl: defaultFields.controllerHostUrl,
        fetchApi: defaultFields.fetchApi,
        additionalHeaders: defaultFields.additionalHeaders,
        sourceTag: defaultFields.sourceTag,
      } as PineconeConfiguration;
      this.client = getPineconeClient(config);
    } else {
      this.client = getPineconeClient();
    }

    if (!defaultFields.model) {
      this.model = "multilingual-e5-large";
    } else {
      this.model = defaultFields.model;
    }

    const defaultParams = { inputType: "passage" };

    if (defaultFields.params) {
      this.params = { ...defaultFields.params, ...defaultParams };
    } else {
      this.params = defaultParams;
    }
  }

  /* Generate embeddings for a list of input strings using a specified embedding model.
   *
   * @param texts - List of input strings for which to generate embeddings.
   * */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      throw new Error(
        "At least one document is required to generate embeddings"
      );
    }

    let embeddings;
    if (this.params) {
      embeddings = await this.caller.call(async () => {
        const result: EmbeddingsList = await this.client.inference.embed(
          this.model,
          texts,
          this.params
        );
        return result;
      });
    } else {
      embeddings = await this.caller.call(async () => {
        const result: EmbeddingsList = await this.client.inference.embed(
          this.model,
          texts,
          {}
        );
        return result;
      });
    }

    const embeddingsList: number[][] = [];

    for (let i = 0; i < embeddings.length; i += 1) {
      if (embeddings[i].values) {
        embeddingsList.push(embeddings[i].values as number[]);
      }
    }
    return embeddingsList;
  }

  /* Generate embeddings for a given query string using a specified embedding model.
   * @param text - Query string for which to generate embeddings.
   * */
  async embedQuery(text: string): Promise<number[]> {
    // Change inputType to query-specific param for multilingual-e5-large embedding model
    this.params.inputType = "query";

    if (!text) {
      throw new Error("No query passed for which to generate embeddings");
    }
    let embeddings: EmbeddingsList;
    if (this.params) {
      embeddings = await this.caller.call(async () => {
        return await this.client.inference.embed(
          this.model,
          [text],
          this.params
        );
      });
    } else {
      embeddings = await this.caller.call(async () => {
        return await this.client.inference.embed(this.model, [text], {});
      });
    }
    if (embeddings[0].values) {
      return embeddings[0].values as number[];
    } else {
      return [];
    }
  }
}
