import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

export interface ByteDanceDoubaoEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use */
  model: string;

  /**
   * Timeout to use when making requests to ByteDanceDoubao.
   */
  timeout?: number;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the ByteDanceDoubao API to a maximum of 2048.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text.
   */
  stripNewLines?: boolean;
}

interface EmbeddingCreateParams {
  model: ByteDanceDoubaoEmbeddingsParams["model"];
  input: string[];
  encoding_format?: "float";
}

interface EmbeddingResponse {
  data: {
    index: number;
    embedding: number[];
  }[];

  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };

  id: string;
}

interface EmbeddingErrorResponse {
  type: string;
  code: string;
  param: string;
  message: string;
}

export class ByteDanceDoubaoEmbeddings
  extends Embeddings
  implements ByteDanceDoubaoEmbeddingsParams
{
  model: string;

  batchSize = 24;

  stripNewLines = true;

  apiKey: string;

  constructor(
    fields?: Partial<ByteDanceDoubaoEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
    }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };
    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey ?? getEnvironmentVariable("ARK_API_KEY");

    if (!apiKey) throw new Error("ByteDanceDoubao API key not found");

    this.apiKey = apiKey;

    this.model = fieldsWithDefaults?.model ?? this.model;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.stripNewLines =
      fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the ByteDanceDoubao API to generate
   * embeddings.
   * @param texts Array of documents to generate embeddings for.
   * @returns Promise that resolves to a 2D array of embeddings for each document.
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );
    const batchRequests = batches.map((batch) => {
      const params = this.getParams(batch);

      return this.embeddingWithRetry(params);
    });

    const batchResponses = await Promise.all(batchRequests);
    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batch = batches[i];
      const batchResponse = batchResponses[i] || [];
      for (let j = 0; j < batch.length; j += 1) {
        embeddings.push(batchResponse[j]);
      }
    }

    return embeddings;
  }

  /**
   * Method to generate an embedding for a single document. Calls the
   * embeddingWithRetry method with the document as the input.
   * @param text Document to generate an embedding for.
   * @returns Promise that resolves to an embedding for the document.
   */
  async embedQuery(text: string): Promise<number[]> {
    const params = this.getParams([
      this.stripNewLines ? text.replace(/\n/g, " ") : text,
    ]);

    const embeddings = (await this.embeddingWithRetry(params)) || [[]];
    return embeddings[0];
  }

  /**
   * Method to generate an embedding params.
   * @param texts Array of documents to generate embeddings for.
   * @returns an embedding params.
   */
  private getParams(
    texts: EmbeddingCreateParams["input"]
  ): EmbeddingCreateParams {
    return {
      model: this.model,
      input: texts,
    };
  }

  /**
   * Private method to make a request to the OpenAI API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param request Request to send to the OpenAI API.
   * @returns Promise that resolves to the response from the API.
   */
  private async embeddingWithRetry(body: EmbeddingCreateParams) {
    return fetch("https://ark.cn-beijing.volces.com/api/v3/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    }).then(async (response) => {
      const embeddingData: EmbeddingResponse | EmbeddingErrorResponse =
        await response.json();

      if ("code" in embeddingData && embeddingData.code) {
        throw new Error(`${embeddingData.code}: ${embeddingData.message}`);
      }

      return (embeddingData as EmbeddingResponse).data.map(
        ({ embedding }) => embedding
      );
    });
  }
}
