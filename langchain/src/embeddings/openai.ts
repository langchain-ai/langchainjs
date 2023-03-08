import { Configuration, OpenAIApi, CreateEmbeddingRequest } from "openai";
import { backOff } from "exponential-backoff";
import pMap from "p-map";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { chunkArray } from "../util/index.js";
import { Embeddings } from "./base.js";

interface ModelParams {
  modelName: string;
}

export class OpenAIEmbeddings extends Embeddings implements ModelParams {
  modelName = "text-embedding-ada-002";

  batchSize = 20;

  concurrency = 10;

  maxRetries = 6;

  private apiKey: string;

  private client: OpenAIApi;

  constructor(
    fields?: Partial<ModelParams> & {
      verbose?: boolean;
      batchSize?: number;
      concurrency?: number;
      maxRetries?: number;
      openAIApiKey?: string;
    }
  ) {
    super();

    const apiKey = fields?.openAIApiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.concurrency = fields?.concurrency ?? this.concurrency;
    this.apiKey = apiKey;
    this.maxRetries = fields?.maxRetries ?? this.maxRetries;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const subPrompts = chunkArray(texts, this.batchSize);

    const embeddings = await pMap(
      subPrompts,
      async (input) => {
        const { data } = await this.embeddingWithRetry({
          model: this.modelName,
          input,
        });

        return data.data.map((i) => i.embedding);
      },
      { concurrency: this.concurrency }
    );

    return embeddings.flat();
  }

  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.modelName,
      input: text,
    });
    return data.data[0].embedding;
  }

  private async embeddingWithRetry(request: CreateEmbeddingRequest) {
    if (!this.client) {
      const clientConfig = new Configuration({
        apiKey: this.apiKey,
        baseOptions: { adapter: fetchAdapter },
      });
      this.client = new OpenAIApi(clientConfig);
    }
    const makeCompletionRequest = () => this.client.createEmbedding(request);
    return backOff(makeCompletionRequest, {
      startingDelay: 4,
      maxDelay: 10,
      numOfAttempts: this.maxRetries,
    });
  }
}
