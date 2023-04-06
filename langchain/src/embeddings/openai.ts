import {
  Configuration,
  OpenAIApi,
  CreateEmbeddingRequest,
  ConfigurationParameters,
} from "openai";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { chunkArray } from "../util/chunk.js";
import { Embeddings, EmbeddingsParams } from "./base.js";

interface ModelParams {
  /** Model name to use */
  modelName: string;

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;
}

export class OpenAIEmbeddings extends Embeddings implements ModelParams {
  modelName = "text-embedding-ada-002";

  /**
   * The maximum number of documents to embed in a single request. This is
   * limited by the OpenAI API to a maximum of 2048.
   */
  batchSize = 512;

  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI, but may not be suitable for all use cases.
   */
  stripNewLines = true;

  timeout?: number;

  private client: OpenAIApi;

  private clientConfig: ConfigurationParameters;

  constructor(
    fields?: Partial<ModelParams> &
      EmbeddingsParams & {
        verbose?: boolean;
        batchSize?: number;
        openAIApiKey?: string;
        stripNewLines?: boolean;
      },
    configuration?: ConfigurationParameters
  ) {
    super(fields ?? {});

    const apiKey =
      fields?.openAIApiKey ??
      // eslint-disable-next-line no-process-env
      (typeof process !== "undefined" ? process.env.OPENAI_API_KEY : undefined);
    if (!apiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.modelName = fields?.modelName ?? this.modelName;
    this.batchSize = fields?.batchSize ?? this.batchSize;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.timeout = fields?.timeout;

    this.clientConfig = {
      apiKey,
      ...configuration,
    };
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const subPrompts = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replaceAll("\n", " ")) : texts,
      this.batchSize
    );

    const embeddings: number[][] = [];

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
      input: this.stripNewLines ? text.replaceAll("\n", " ") : text,
    });
    return data.data[0].embedding;
  }

  private async embeddingWithRetry(request: CreateEmbeddingRequest) {
    if (!this.client) {
      const clientConfig = new Configuration({
        ...this.clientConfig,
        baseOptions: {
          timeout: this.timeout,
          adapter: fetchAdapter,
          ...this.clientConfig.baseOptions,
        },
      });
      this.client = new OpenAIApi(clientConfig);
    }
    return this.caller.call(
      this.client.createEmbedding.bind(this.client),
      request
    );
  }
}
