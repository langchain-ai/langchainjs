import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

/** @deprecated Install and import from @langchain/baidu-qianfan instead. */
export interface BaiduQianfanEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use */
  model: "embedding-v1" | "bge_large_zh" | "bge_large_en" | "tao-8k";

  /**
   * Timeout to use when making requests to BaiduQianfan.
   */
  timeout?: number;

  /**
   * The maximum number of characters allowed for embedding in a single request varies by model:
   * - Embedding-V1 model: up to 1000 characters
   * - bge-large-zh model: up to 2000 characters
   * - bge-large-en model: up to 2000 characters
   * - tao-8k model: up to 28000 characters
   *
   * Note: These limits are model-specific and should be adhered to for optimal performance.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text.
   */
  stripNewLines?: boolean;
}

interface EmbeddingCreateParams {
  input: string[];
}

interface EmbeddingResponse {
  data: { object: "embedding"; index: number; embedding: number[] }[];

  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };

  id: string;
}

interface EmbeddingErrorResponse {
  error_code: number | string;
  error_msg: string;
}

export class BaiduQianfanEmbeddings
  extends Embeddings
  implements BaiduQianfanEmbeddingsParams
{
  model: BaiduQianfanEmbeddingsParams["model"] = "embedding-v1";

  batchSize = 16;

  stripNewLines = true;

  baiduApiKey: string;

  baiduSecretKey: string;

  accessToken: string;

  constructor(
    fields?: Partial<BaiduQianfanEmbeddingsParams> & {
      verbose?: boolean;
      baiduApiKey?: string;
      baiduSecretKey?: string;
    }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };
    super(fieldsWithDefaults);

    const baiduApiKey =
      fieldsWithDefaults?.baiduApiKey ??
      getEnvironmentVariable("BAIDU_API_KEY");

    const baiduSecretKey =
      fieldsWithDefaults?.baiduSecretKey ??
      getEnvironmentVariable("BAIDU_SECRET_KEY");

    if (!baiduApiKey) {
      throw new Error("Baidu API key not found");
    }

    if (!baiduSecretKey) {
      throw new Error("Baidu Secret key not found");
    }

    this.baiduApiKey = baiduApiKey;
    this.baiduSecretKey = baiduSecretKey;

    this.model = fieldsWithDefaults?.model ?? this.model;

    if (this.model === "tao-8k") {
      if (fieldsWithDefaults?.batchSize && fieldsWithDefaults.batchSize !== 1) {
        throw new Error(
          "tao-8k model supports only a batchSize of 1. Please adjust your batchSize accordingly"
        );
      }
      this.batchSize = 1;
    } else {
      this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    }

    this.stripNewLines =
      fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the BaiduQianFan API to generate
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
      input: texts,
    };
  }

  /**
   * Private method to make a request to the BaiduAI API to generate
   * embeddings. Handles the retry logic and returns the response from the
   * API.
   * @param request Request to send to the BaiduAI API.
   * @returns Promise that resolves to the response from the API.
   */
  private async embeddingWithRetry(body: EmbeddingCreateParams) {
    if (!this.accessToken) {
      this.accessToken = await this.getAccessToken();
    }

    return fetch(
      `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/embeddings/${this.model}?access_token=${this.accessToken}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    ).then(async (response) => {
      const embeddingData: EmbeddingResponse | EmbeddingErrorResponse =
        await response.json();

      if ("error_code" in embeddingData && embeddingData.error_code) {
        throw new Error(
          `${embeddingData.error_code}: ${embeddingData.error_msg}`
        );
      }

      return (embeddingData as EmbeddingResponse).data.map(
        ({ embedding }) => embedding
      );
    });
  }

  /**
   * Method that retrieves the access token for making requests to the Baidu
   * API.
   * @returns The access token for making requests to the Baidu API.
   */
  private async getAccessToken() {
    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${this.baiduApiKey}&client_secret=${this.baiduSecretKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const text = await response.text();
      const error = new Error(
        `Baidu get access token failed with status code ${response.status}, response: ${text}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }
    const json = await response.json();
    return json.access_token;
  }
}
