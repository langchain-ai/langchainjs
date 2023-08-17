import { TransformersEmbeddingFunction } from "chromadb";
import { chunkArray } from "../util/chunk.js";
import { Embeddings, EmbeddingsParams } from "./base.js";

export interface HuggingFaceTransformersEmbeddingsParams
  extends EmbeddingsParams {
  /** Model name to use */
  modelName: string;

  /**
   * Timeout to use when making requests to OpenAI.
   */
  timeout?: number;

  /**
   * The maximum number of documents to embed in a single request.
   */
  batchSize?: number;

  /**
   * Whether to strip new lines from the input text. This is recommended by
   * OpenAI, but may not be suitable for all use cases.
   */
  stripNewLines?: boolean;
}

export class HuggingFaceTransformersEmbeddings
  extends Embeddings
  implements HuggingFaceTransformersEmbeddingsParams
{
  modelName = "Xenova/all-MiniLM-L6-v2";

  embedder = new TransformersEmbeddingFunction({
    model: this.modelName,
  });

  batchSize = 512;

  stripNewLines = true;

  timeout?: number;

  constructor(fields?: Partial<HuggingFaceTransformersEmbeddingsParams>) {
    super(fields ?? {});

    this.modelName = fields?.modelName ?? this.modelName;
    this.embedder = new TransformersEmbeddingFunction({
      model: this.modelName,
    });
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.timeout = fields?.timeout;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const subPrompts = chunkArray(
      this.stripNewLines ? texts.map((t) => t.replace(/\n/g, " ")) : texts,
      this.batchSize
    );

    const embeddings: number[][] = [];

    for (let i = 0; i < subPrompts.length; i += 1) {
      const input = subPrompts[i];
      const data = await this.embedder.generate(input);

      for (let j = 0; j < input.length; j += 1) {
        embeddings.push(data[j]);
      }
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const data = await this.embedder.generate([
      this.stripNewLines ? text.replace(/\n/g, " ") : text,
    ]);
    return data[0];
  }
}
