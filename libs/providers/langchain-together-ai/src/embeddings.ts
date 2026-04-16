import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface TogetherAIEmbeddingsParams extends EmbeddingsParams {
  /**
   * The API key to use for the Together AI API.
   * @default {process.env.TOGETHER_AI_API_KEY}
   */
  apiKey?: string;
  /**
   * Model name to use.
   * Alias for `model`.
   * @default {"togethercomputer/m2-bert-80M-8k-retrieval"}
   */
  modelName?: string;
  /**
   * Model name to use.
   * @default {"togethercomputer/m2-bert-80M-8k-retrieval"}
   */
  model?: string;
  /**
   * Timeout to use when making requests to Together AI.
   */
  timeout?: number;
  /**
   * The maximum number of documents to embed in a single logical batch.
   * @default {512}
   */
  batchSize?: number;
  /**
   * Whether to strip new lines from the input text.
   * @default {false}
   */
  stripNewLines?: boolean;
}

interface TogetherAIEmbeddingsResult {
  object: string;
  data: Array<{
    object: "embedding";
    embedding: number[];
    index: number;
  }>;
  model: string;
  request_id: string;
}

/**
 * Class for generating embeddings using the Together AI embeddings API.
 */
export class TogetherAIEmbeddings
  extends Embeddings
  implements TogetherAIEmbeddingsParams
{
  lc_serializable = true;

  lc_namespace = ["langchain", "embeddings", "together_ai"];

  modelName = "togethercomputer/m2-bert-80M-8k-retrieval";

  model = "togethercomputer/m2-bert-80M-8k-retrieval";

  apiKey: string;

  batchSize = 512;

  stripNewLines = false;

  timeout?: number;

  private embeddingsAPIUrl = "https://api.together.xyz/v1/embeddings";

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "TOGETHER_AI_API_KEY",
    };
  }

  constructor(fields?: Partial<TogetherAIEmbeddingsParams>) {
    super(fields ?? {});

    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("TOGETHER_AI_API_KEY");
    if (!apiKey) {
      throw new Error("TOGETHER_AI_API_KEY not found.");
    }

    this.apiKey = apiKey;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
    this.timeout = fields?.timeout;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
  }

  private constructHeaders() {
    return {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private constructBody(input: string) {
    return {
      model: this.model,
      input,
    };
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    let batchResponses: TogetherAIEmbeddingsResult[] = [];
    for await (const batch of batches) {
      const batchRequests = batch.map((item) => this.embeddingWithRetry(item));
      const response = await Promise.all(batchRequests);
      batchResponses = batchResponses.concat(response);
    }

    return batchResponses.map((response) => response.data[0].embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry(
      this.stripNewLines ? text.replace(/\n/g, " ") : text
    );
    return data[0].embedding;
  }

  private async embeddingWithRetry(
    input: string
  ): Promise<TogetherAIEmbeddingsResult> {
    const body = JSON.stringify(this.constructBody(input));
    const headers = this.constructHeaders();

    return this.caller.call(async () => {
      const fetchResponse = await fetch(this.embeddingsAPIUrl, {
        method: "POST",
        headers,
        body,
      });

      if (fetchResponse.status === 200) {
        return fetchResponse.json();
      }
      throw new Error(
        `Error getting prompt completion from Together AI. ${JSON.stringify(
          await fetchResponse.json(),
          null,
          2
        )}`
      );
    });
  }
}
