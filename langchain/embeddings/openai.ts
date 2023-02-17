import type {
  Configuration as ConfigurationT,
  OpenAIApi as OpenAIApiT,
  CreateEmbeddingRequest,
} from "openai";
import { backOff } from "exponential-backoff";
import { chunkArray } from "../util";
import { Embeddings } from "./base";

let Configuration: typeof ConfigurationT | null = null;
let OpenAIApi: typeof OpenAIApiT | null = null;

try {
  // eslint-disable-next-line global-require,import/no-extraneous-dependencies
  ({ Configuration, OpenAIApi } = require("openai"));
} catch {
  // ignore error
}

interface ModelParams {
  modelName: string;
}

export class OpenAIEmbeddings extends Embeddings implements ModelParams {
  modelName = "text-embedding-ada-002";

  batchSize = 20;

  maxRetries = 6;

  private client: OpenAIApiT;

  constructor(
    fields?: Partial<ModelParams> & {
      verbose?: boolean;
      batchSize?: number;
      maxRetries?: number;
      openAIApiKey?: string;
    }
  ) {
    super();
    if (Configuration === null || OpenAIApi === null) {
      throw new Error(
        "Please install openai as a dependency with, e.g. `npm install -S openai`"
      );
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    const clientConfig = new Configuration({
      apiKey: fields?.openAIApiKey ?? process.env.OPENAI_API_KEY,
    });
    this.client = new OpenAIApi(clientConfig);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const subPrompts = chunkArray(texts, this.batchSize);

    const embeddings = [];

    for (let i = 0; i < subPrompts.length; i += 1) {
      const input = subPrompts[i];
      const { data } = await this.embeddingWithRetry({
        model: this.modelName,
        input,
      });
      for (let j = 0; j < input.length; j += 1) {
        embeddings.push(data.data[j].embedding);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const { data } = await this.embeddingWithRetry({
      model: this.modelName,
      input: text,
    });
    return data.data[0].embedding;
  }

  private embeddingWithRetry(request: CreateEmbeddingRequest) {
    const makeCompletionRequest = () => this.client.createEmbedding(request);
    return backOff(makeCompletionRequest, {
      startingDelay: 4,
      maxDelay: 10,
      numOfAttempts: this.maxRetries,
    });
  }
}
