import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import {
  EmbeddingsList,
  Pinecone,
  PineconeConfiguration,
} from "@pinecone-database/pinecone";
import { getPineconeClient } from "./client.js";

// todo: docstrings https://docs.pinecone.io/guides/inference/understanding-inference#multilingual-e5-large

export interface PineconeEmbeddingsParams extends EmbeddingsParams {
  model?: string; // Model to use to generate embeddings
  params?: Record<string, string>; // Additional parameters to pass to the embedding model
}

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

  // @returns A promise that resolves to an array of vectors for each document.
  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      throw new Error(
        "At least one document is required to generate embeddings"
      );
    }

    let embeddings: EmbeddingsList;
    if (this.params) {
      embeddings = await this.client.inference.embed(
        this.model,
        texts,
        this.params
      );
    } else {
      embeddings = await this.client.inference.embed(this.model, texts, {});
    }

    const embeddingsList: number[][] = [];

    for (let i = 0; i < embeddings.length; i += 1) {
      if (embeddings[i].values) {
        embeddingsList.push(embeddings[i].values as number[]);
      }
    }
    return embeddingsList;
  }

  async embedQuery(text: string): Promise<number[]> {
    // Change inputType to query-specific param for multilingual-e5-large embedding model
    this.params.inputType = "query";

    if (!text) {
      throw new Error("No query passed for which to generate embeddings");
    }
    let embeddings: EmbeddingsList;
    if (this.params) {
      embeddings = await this.client.inference.embed(
        this.model,
        [text],
        this.params
      );
    } else {
      embeddings = await this.client.inference.embed(this.model, [text], {});
    }
    if (embeddings[0].values) {
      return embeddings[0].values as number[];
    } else {
      return [];
    }
  }
}
