import { distance, similarity } from "ml-distance";
import {
  PairwiseStringEvaluator,
  PairwiseStringEvaluatorArgs,
  StringEvaluator,
  StringEvaluatorArgs,
} from "../base.js";
import { ChainValues } from "../../schema/index.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import {
  CallbackManagerForChainRun,
  Callbacks,
} from "../../callbacks/index.js";
import { BaseCallbackConfig } from "../../callbacks/manager.js";
import { Embeddings } from "../../embeddings/base.js";

/**
 *
 * Embedding Distance Metric.
 *
 * COSINE: Cosine distance metric.
 * EUCLIDEAN: Euclidean distance metric.
 * MANHATTAN: Manhattan distance metric.
 * CHEBYSHEV: Chebyshev distance metric.
 * HAMMING: Hamming distance metric.
 */
export type EmbeddingDistanceType =
  | "cosine"
  | "euclidean"
  | "manhattan"
  | "chebyshev";

/**
 * Embedding Distance Evaluation Chain Input.
 */
export interface EmbeddingDistanceEvalChainInput {
  /**
   * The embedding objects to vectorize the outputs.
   */
  embedding?: Embeddings;

  /**
   * The distance metric to use
   * for comparing the embeddings.
   */
  distanceMetric?: EmbeddingDistanceType;
}

type VectorFunction = (xVector: number[], yVector: number[]) => number;

/**
 * Get the distance function for the given distance type.
 * @param distance The distance type.
 * @return The distance function.
 */
export function getDistanceCalculationFunction(
  distanceType: EmbeddingDistanceType
): VectorFunction {
  const distanceFunctions: { [key in EmbeddingDistanceType]: VectorFunction } =
    {
      cosine: (X: number[], Y: number[]) => 1.0 - similarity.cosine(X, Y),
      euclidean: distance.euclidean,
      manhattan: distance.manhattan,
      chebyshev: distance.chebyshev,
    };

  return distanceFunctions[distanceType];
}

/**
 * Compute the score based on the distance metric.
 * @param vectors The input vectors.
 * @param distanceMetric The distance metric.
 * @return The computed score.
 */
export function computeEvaluationScore(
  vectors: number[][],
  distanceMetric: EmbeddingDistanceType
): number {
  const metricFunction = getDistanceCalculationFunction(distanceMetric);
  return metricFunction(vectors[0], vectors[1]);
}

/**
 * Use embedding distances to score semantic difference between
 * a prediction and reference.
 */
export class EmbeddingDistanceEvalChain
  extends StringEvaluator
  implements EmbeddingDistanceEvalChainInput
{
  requiresReference = true;

  requiresInput = false;

  outputKey = "score";

  embedding?: Embeddings;

  distanceMetric: EmbeddingDistanceType = "cosine";

  constructor(fields: EmbeddingDistanceEvalChainInput) {
    super();
    this.embedding = fields?.embedding || new OpenAIEmbeddings();
    this.distanceMetric = fields?.distanceMetric || "cosine";
  }

  _chainType() {
    return `embedding_${this.distanceMetric}_distance` as const;
  }

  async _evaluateStrings(
    args: StringEvaluatorArgs,
    config: Callbacks | BaseCallbackConfig | undefined
  ): Promise<ChainValues> {
    const result = await this.call(args, config);

    return { [this.outputKey]: result[this.outputKey] };
  }

  get inputKeys(): string[] {
    return ["reference", "prediction"];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }

  async _call(
    values: ChainValues,
    _runManager: CallbackManagerForChainRun | undefined
  ): Promise<ChainValues> {
    const { prediction, reference } = values;

    if (!this.embedding) throw new Error("Embedding is undefined");

    const vectors = await this.embedding.embedDocuments([
      prediction,
      reference,
    ]);

    const score = computeEvaluationScore(vectors, this.distanceMetric);

    return { [this.outputKey]: score };
  }
}

/**
 * Use embedding distances to score semantic difference between two predictions.
 */
export class PairwiseEmbeddingDistanceEvalChain
  extends PairwiseStringEvaluator
  implements EmbeddingDistanceEvalChainInput
{
  requiresReference = false;

  requiresInput = false;

  outputKey = "score";

  embedding?: Embeddings;

  distanceMetric: EmbeddingDistanceType = "cosine";

  constructor(fields: EmbeddingDistanceEvalChainInput) {
    super();
    this.embedding = fields?.embedding || new OpenAIEmbeddings();
    this.distanceMetric = fields?.distanceMetric || "cosine";
  }

  _chainType() {
    return `pairwise_embedding_${this.distanceMetric}_distance` as const;
  }

  async _evaluateStringPairs(
    args: PairwiseStringEvaluatorArgs,
    config?: Callbacks | BaseCallbackConfig
  ): Promise<ChainValues> {
    const result = await this.call(args, config);

    return { [this.outputKey]: result[this.outputKey] };
  }

  get inputKeys(): string[] {
    return ["prediction", "predictionB"];
  }

  get outputKeys(): string[] {
    return [this.outputKey];
  }

  async _call(
    values: ChainValues,
    _runManager: CallbackManagerForChainRun | undefined
  ): Promise<ChainValues> {
    const { prediction, predictionB } = values;

    if (!this.embedding) throw new Error("Embedding is undefined");

    const vectors = await this.embedding.embedDocuments([
      prediction,
      predictionB,
    ]);

    const score = computeEvaluationScore(vectors, this.distanceMetric);

    return { [this.outputKey]: score };
  }
}
