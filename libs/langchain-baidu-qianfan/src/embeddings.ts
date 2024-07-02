import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embedding } from "@baiducloud/qianfan";

export interface BaiduQianfanEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use */
  modelName: "Embedding-V1" | "bge-large-zh" | "bge-large-en" | "tao-8k";

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
  modelName: BaiduQianfanEmbeddingsParams["modelName"] = "Embedding-V1";

  batchSize = 16;

  stripNewLines = true;

  qianfanAK: string | undefined;

  qianfanSK: string | undefined;

  qianfanAccessKey: string | undefined;

  qianfanSecretKey: string | undefined;

  accessToken: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embeddings: any;

  constructor(
    fields?: Partial<BaiduQianfanEmbeddingsParams> & {
      verbose?: boolean;
      qianfanAK?: string;
      qianfanSK?: string;
      qianfanAccessKey?: string;
      qianfanSecretKey?: string;
    }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };
    super(fieldsWithDefaults);

    this.qianfanAK =
      fieldsWithDefaults?.qianfanAK ?? getEnvironmentVariable("QIANFAN_AK");

    this.qianfanSK =
      fieldsWithDefaults?.qianfanSK ?? getEnvironmentVariable("QIANFAN_SK");

    this.qianfanAccessKey =
      fieldsWithDefaults?.qianfanAccessKey ??
      getEnvironmentVariable("QIANFAN_ACCESS_KEY");

    this.qianfanSecretKey =
      fieldsWithDefaults?.qianfanSecretKey ??
      getEnvironmentVariable("QIANFAN_SECRET_KEY");

    // 优先使用安全认证AK/SK鉴权
    if (this.qianfanAccessKey && this.qianfanSecretKey) {
      this.embeddings = new Embedding({
        QIANFAN_ACCESS_KEY: this.qianfanAccessKey,
        QIANFAN_SECRET_KEY: this.qianfanSecretKey,
      });
    } else if (this.qianfanAK && this.qianfanSK) {
      this.embeddings = new Embedding({
        QIANFAN_AK: this.qianfanAK,
        QIANFAN_SK: this.qianfanSK,
      });
    } else {
      throw new Error("Please provide AK/SK");
    }

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;

    if (this.modelName === "tao-8k") {
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
    const embeddingData: EmbeddingResponse | EmbeddingErrorResponse =
      await this.embeddings.embedding(body, this.modelName);

    if ("error_code" in embeddingData && embeddingData.error_code) {
      throw new Error(
        `${embeddingData.error_code}: ${embeddingData.error_msg}`
      );
    }

    return (embeddingData as EmbeddingResponse).data.map(
      ({ embedding }) => embedding
    );
  }
}
