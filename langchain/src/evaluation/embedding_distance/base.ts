import {distance, similarity} from "ml-distance";
import {
    PairwiseStringEvaluator,
    PairwiseStringEvaluatorArgs,
    StringEvaluator,
    StringEvaluatorArgs
} from "../base.js";
import {ChainValues} from "../../schema/index.js";
import {Embeddings} from "../../embeddings/index.js";
import {OpenAIEmbeddings} from "../../embeddings/openai.js";
import {CallbackManagerForChainRun, Callbacks} from "../../callbacks/index.js";
import {BaseCallbackConfig} from "../../callbacks/manager.js";


export enum EmbeddingDistance {
    COSINE = "cosine",
    EUCLIDEAN = "euclidean",
    MANHATTAN = "manhattan",
    CHEBYSHEV = "chebyshev"
}

export interface EmbeddingDistanceEvalChainInput {
    embedding?: Embeddings;

    distanceMetric?: EmbeddingDistance;
}

type VectorFunction = (xVector: number[], yVector: number[]) => number;


// 创建一个混入，包含共享的方法
class EmbeddingDistanceMixin {

    _get_metric(metric: EmbeddingDistance): VectorFunction {
        const metrics: { [key in EmbeddingDistance]: VectorFunction } = {
            [EmbeddingDistance.COSINE]: this._cosine_distance,
            [EmbeddingDistance.EUCLIDEAN]: this._euclidean_distance,
            [EmbeddingDistance.MANHATTAN]: this._manhattan_distance,
            [EmbeddingDistance.CHEBYSHEV]: this._chebyshev_distance,
        };

        if (metric in metrics) {
            return metrics[metric];
        } else {
            throw new Error(`Invalid metric: ${metric}`);
        }
    }

    _compute_score(vectors: number[][], distanceMetric: EmbeddingDistance): number {
        const metric = this._get_metric(distanceMetric);
        if (!metric) throw new Error("Metric is undefined");
        return metric(vectors[0], vectors[1]);
    }

    _cosine_distance(X: number[], Y: number[]) {
        return 1.0 - similarity.cosine(X, Y);
    }

    _euclidean_distance(X: number[], Y: number[]) {
        return distance.euclidean(X, Y);
    }

    _manhattan_distance(X: number[], Y: number[]) {
        return distance.manhattan(X, Y);
    }

    _chebyshev_distance(X: number[], Y: number[]) {
        return distance.chebyshev(X, Y);
    }

    _prepareOutput(result: ChainValues, outputKey: string) {
        return {[outputKey]: result[outputKey]};
    }

}


export class EmbeddingDistanceEvalChain extends StringEvaluator implements EmbeddingDistanceEvalChainInput {

    requiresReference = true;

    requiresInput = false;

    outputKey = "score";

    embedding?: Embeddings;

    distanceMetric: EmbeddingDistance = EmbeddingDistance.COSINE;

    mixin: EmbeddingDistanceMixin;

    constructor(fields: EmbeddingDistanceEvalChainInput) {
        super();
        this.embedding = fields?.embedding || new OpenAIEmbeddings();
        this.distanceMetric = fields?.distanceMetric || EmbeddingDistance.COSINE;
        this.mixin = new EmbeddingDistanceMixin();
    }


    _chainType() {
        return "embedding_distance_eval_chain" as const;
    }

    async _evaluateStrings(args: StringEvaluatorArgs, config: Callbacks | BaseCallbackConfig | undefined): Promise<ChainValues> {
        const result = await this.call(args, config);

        return this.mixin._prepareOutput(result, this.outputKey);
    }

    get inputKeys(): string[] {
        return ["reference", "prediction"];
    }

    get outputKeys(): string[] {
        return [this.outputKey];
    }

    async _call(values: ChainValues, _runManager: CallbackManagerForChainRun | undefined): Promise<ChainValues> {
        const {prediction, reference} = values;

        if (!this.embedding) throw new Error("Embedding is undefined");

        const vectors = await this.embedding.embedDocuments([prediction, reference]);

        const score = this.mixin._compute_score(vectors, this.distanceMetric);

        return {[this.outputKey]: score};
    }

}

export class PairwiseEmbeddingDistanceEvalChain extends PairwiseStringEvaluator implements EmbeddingDistanceEvalChainInput {


    requiresReference = false;

    requiresInput = false;

    outputKey = "score";

    embedding?: Embeddings;

    distanceMetric: EmbeddingDistance = EmbeddingDistance.COSINE;

    mixin: EmbeddingDistanceMixin;

    constructor(fields: EmbeddingDistanceEvalChainInput) {
        super();
        this.embedding = fields?.embedding || new OpenAIEmbeddings();
        this.distanceMetric = fields?.distanceMetric || EmbeddingDistance.COSINE;
        this.mixin = new EmbeddingDistanceMixin();
    }


    _chainType() {
        return "embedding_distance_eval_chain" as const;
    }

    async _evaluateStringPairs(args: PairwiseStringEvaluatorArgs, config?: Callbacks | BaseCallbackConfig): Promise<ChainValues> {
        const result = await this.call(args, config);

        return this.mixin._prepareOutput(result, this.outputKey);
    }

    get inputKeys(): string[] {
        return ["prediction", "predictionB"];
    }

    get outputKeys(): string[] {
        return [this.outputKey];
    }

    async _call(values: ChainValues, _runManager: CallbackManagerForChainRun | undefined): Promise<ChainValues> {
        const {prediction, predictionB} = values;

        if (!this.embedding) throw new Error("Embedding is undefined");

        const vectors = await this.embedding.embedDocuments([prediction, predictionB]);

        const score = this.mixin._compute_score(vectors, this.distanceMetric);

        return {[this.outputKey]: score};
    }


}
