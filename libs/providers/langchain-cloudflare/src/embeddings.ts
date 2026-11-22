import type { Ai } from "@cloudflare/workers-types";
import { Embeddings, EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

type AiTextEmbeddingsInput = {
  text: string | string[];
};

type AiTextEmbeddingsOutput = {
  shape: number[];
  data: number[][];
};

type AiEmbeddingGemmaInput = {
  input: string[];
  dimensions?: number;
  encoding_format: "float";
};

type AiEmbeddingGemmaOutput = {
  data: { embedding: number[] }[];
};

export interface CloudflareWorkersAIEmbeddingsParams extends EmbeddingsParams {
  /** Binding */
  binding: Ai;

  /**
   * Model name to use
   * Alias for `model`
   */
  modelName?: string;
  /**
   * Model name to use
   */
  model?: string;

  /**
   * The maximum number of documents to embed in a single request.
   */
  batchSize?: number;

  /**
   * Output dimensions for EmbeddingGemma 2 (128, 256, 512, or 768).
   * Omit to use the model default. Not sent to other models.
   */
  dimensions?: number;

  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI, but may not be suitable for all use cases.
   */
  stripNewLines?: boolean;
}

export class CloudflareWorkersAIEmbeddings extends Embeddings {
  modelName = "@cf/baai/bge-base-en-v1.5";

  model = "@cf/baai/bge-base-en-v1.5";

  batchSize = 50;

  stripNewLines = true;

  ai: Ai;

  dimensions?: number;

  constructor(fields: CloudflareWorkersAIEmbeddingsParams) {
    super(fields);

    if (!fields.binding) {
      throw new Error(
        "Must supply a Workers AI binding, eg { binding: env.AI }"
      );
    }
    this.ai = fields.binding;
    this.dimensions = fields.dimensions;
    this.modelName = fields?.model ?? fields.modelName ?? this.model;
    this.model = this.modelName;
    this.stripNewLines = fields.stripNewLines ?? this.stripNewLines;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const batches = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const batchRequests = batches.map((batch) => this.runEmbedding(batch));
    const batchResponses = await Promise.all(batchRequests);
    const embeddings: number[][] = [];

    for (let i = 0; i < batchResponses.length; i += 1) {
      const batchResponse = batchResponses[i];
      for (let j = 0; j < batchResponse.length; j += 1) {
        embeddings.push(batchResponse[j]);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const data = await this.runEmbedding([
      this.stripNewLines ? text.replace(/\n/g, " ") : text,
    ]);
    return data[0];
  }

  private async runEmbedding(texts: string[]) {
    return this.caller.call(async () => {
      if (this.model === "@cf/google/embeddinggemma-2") {
        const response = (await this.ai.run(this.model, {
          input: texts,
          encoding_format: "float",
          ...(this.dimensions !== undefined
            ? { dimensions: this.dimensions }
            : {}),
        } as AiEmbeddingGemmaInput)) as AiEmbeddingGemmaOutput;
        return response.data.map((item) => item.embedding);
      }
      const response: AiTextEmbeddingsOutput = await this.ai.run(
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        this.model as any,
        {
          text: texts,
        } as AiTextEmbeddingsInput
      );
      return response.data;
    });
  }
}
