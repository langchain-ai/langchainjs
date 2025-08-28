import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

export interface AlibabaTongyiEmbeddingsParams extends EmbeddingsParams {
  /** Model name to use */
  modelName:
    | "multimodal-embedding-v1"
    | "text-embedding-v1"
    | "text-embedding-v2"
    | "text-embedding-v3"
    | "text-embedding-v4";

  /**
   * Timeout to use when making requests to AlibabaTongyi.
   */
  timeout?: number;

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the AlibabaTongyi API to a maximum of 2048.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text.
   */
  stripNewLines?: boolean;

  parameters?: {
    /**
     * 取值：query 或者 document，默认值为 document
     * 说明：文本转换为向量后可以应用于检索、聚类、分类等下游任务，
     * 	对检索这类非对称任务为了达到更好的检索效果建议区分查询文本（query）和
     * 	底库文本（document）类型, 聚类、分类等对称任务可以不用特殊指定，
     * 	采用系统默认值"document"即可
     */
    text_type?: "query" | "document";
  };
}

interface EmbeddingCreateParams {
  model: AlibabaTongyiEmbeddingsParams["modelName"];
  input: {
    texts: string[];
  };

  parameters?: AlibabaTongyiEmbeddingsParams["parameters"];
}

interface EmbeddingResponse {
  output: {
    embeddings: { text_index: number; embedding: number[] }[];
  };

  usage: {
    total_tokens: number;
  };

  request_id: string;
}

interface EmbeddingErrorResponse {
  code: string;
  message: string;
  request_id: string;
}

export class AlibabaTongyiEmbeddings
  extends Embeddings
  implements AlibabaTongyiEmbeddingsParams
{
  modelName: AlibabaTongyiEmbeddingsParams["modelName"] = "text-embedding-v2";

  batchSize = 24;

  stripNewLines = true;

  apiKey: string;

  parameters: EmbeddingCreateParams["parameters"];

  constructor(
    fields?: Partial<AlibabaTongyiEmbeddingsParams> & {
      verbose?: boolean;
      apiKey?: string;
    }
  ) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...fields };
    super(fieldsWithDefaults);

    const apiKey =
      fieldsWithDefaults?.apiKey ?? getEnvironmentVariable("ALIBABA_API_KEY");

    if (!apiKey) throw new Error("AlibabaAI API key not found");

    this.apiKey = apiKey;

    this.modelName = fieldsWithDefaults?.modelName ?? this.modelName;
    this.batchSize = fieldsWithDefaults?.batchSize ?? this.batchSize;
    this.stripNewLines =
      fieldsWithDefaults?.stripNewLines ?? this.stripNewLines;

    this.parameters = {
      text_type: fieldsWithDefaults?.parameters?.text_type ?? "document",
    };
  }

  /**
   * Method to generate embeddings for an array of documents. Splits the
   * documents into batches and makes requests to the AlibabaTongyi API to generate
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
    texts: EmbeddingCreateParams["input"]["texts"]
  ): EmbeddingCreateParams {
    return {
      model: this.modelName,
      input: {
        texts,
      },
      parameters: this.parameters,
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
    return fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      }
    ).then(async (response) => {
      const embeddingData: EmbeddingResponse | EmbeddingErrorResponse =
        await response.json();

      if ("code" in embeddingData && embeddingData.code) {
        throw new Error(`${embeddingData.code}: ${embeddingData.message}`);
      }

      return (embeddingData as EmbeddingResponse).output.embeddings.map(
        ({ embedding }) => embedding
      );
    });
  }
}
