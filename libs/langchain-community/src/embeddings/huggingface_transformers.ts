import type {
  PretrainedOptions,
  FeatureExtractionPipelineOptions,
  FeatureExtractionPipeline,
} from "@huggingface/transformers";
import { Embeddings, type EmbeddingsParams } from "@langchain/core/embeddings";
import { chunkArray } from "@langchain/core/utils/chunk_array";

export interface HuggingFaceTransformersEmbeddingsParams
  extends EmbeddingsParams {
  /** Model name to use */
  model: string;

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

  /**
   * Optional parameters for the pretrained model.
   */
  pretrainedOptions?: PretrainedOptions;

  /**
   * Optional parameters for the pipeline.
   */
  pipelineOptions?: FeatureExtractionPipelineOptions;
}

/**
 * @example
 * ```typescript
 * const model = new HuggingFaceTransformersEmbeddings({
 *   model: "Xenova/all-MiniLM-L6-v2",
 * });
 *
 * // Embed a single query
 * const res = await model.embedQuery(
 *   "What would be a good company name for a company that makes colorful socks?"
 * );
 * console.log({ res });
 *
 * // Embed multiple documents
 * const documentRes = await model.embedDocuments(["Hello world", "Bye bye"]);
 * console.log({ documentRes });
 * ```
 */
export class HuggingFaceTransformersEmbeddings
  extends Embeddings
  implements HuggingFaceTransformersEmbeddingsParams
{
  model = "Xenova/all-MiniLM-L6-v2";

  batchSize = 512;

  stripNewLines = true;

  timeout?: number;

  pretrainedOptions?: PretrainedOptions;

  pipelineOptions?: FeatureExtractionPipelineOptions;

  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(fields?: Partial<HuggingFaceTransformersEmbeddingsParams>) {
    super(fields ?? {});

    this.model = fields?.model ?? this.model;
    this.stripNewLines = fields?.stripNewLines ?? this.stripNewLines;
    this.timeout = fields?.timeout;
    this.pretrainedOptions = fields?.pretrainedOptions ?? {};
    this.pipelineOptions = {
      pooling: "mean",
      normalize: true,
      ...fields?.pipelineOptions,
    };
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
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        const transformers = await import("@huggingface/transformers");
        const pipeline = transformers.pipeline;
        const result = await pipeline(
          "feature-extraction",
          this.model,
          this.pretrainedOptions
        );
        return result as FeatureExtractionPipeline;
      })();
    }

    const pipe = await this.pipelinePromise;
    return this.caller.call(async () => {
      const output = await pipe(texts, this.pipelineOptions);
      return output.tolist();
    });
  }
}
