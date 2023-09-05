import {distance, similarity} from "ml-distance";
import {StringEvaluator, StringEvaluatorArgs} from "../base.js";
import {ChainValues, RUN_KEY} from "../../schema/index.js";
import {Embeddings, OpenAIEmbeddings} from "../../embeddings/index.js";
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

export class EmbeddingDistanceEvalChain extends StringEvaluator implements EmbeddingDistanceEvalChainInput {

    embedding?: Embeddings;

    distanceMetric: EmbeddingDistance = EmbeddingDistance.COSINE;

    requiresReference = true;

    requiresInput = false;

    outputKey = "score";

    constructor(fields?: EmbeddingDistanceEvalChainInput) {
        super();

        this.embedding = fields?.embedding || new OpenAIEmbeddings();
        this.distanceMetric = fields?.distanceMetric || EmbeddingDistance.COSINE;
    }


    private _get_metric(metric: EmbeddingDistance): VectorFunction {
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

    private _compute_score(vectors: number[][]): number {
        const metric = this._get_metric(this.distanceMetric);
        if (!metric) throw new Error("Metric is undefined");
        return metric(vectors[0], vectors[1]);
    }

    private _cosine_distance(X: number[], Y: number[]) {
        return 1.0 - similarity.cosine(X, Y);
    }

    private _euclidean_distance(X: number[], Y: number[]) {
        return distance.euclidean(X, Y);
    }

    private _manhattan_distance(X: number[], Y: number[]) {
        return distance.manhattan(X, Y);
    }

    private _chebyshev_distance(X: number[], Y: number[]) {
        return distance.chebyshev(X, Y);
    }


    _prepareOutput(result: ChainValues) {
        const parsed = {[this.outputKey]: result[this.outputKey]};
        if (RUN_KEY in result && result[RUN_KEY]) {
            parsed[RUN_KEY] = result[RUN_KEY];
        }
        return parsed;
    }

    _chainType() {
        return "embedding_distance_eval_chain" as const;
    }

    async _evaluateStrings(args: StringEvaluatorArgs, config: Callbacks | BaseCallbackConfig | undefined): Promise<ChainValues> {
        const result = await this.call(args, config);

        return this._prepareOutput(result);
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

        const score = this._compute_score(vectors);

        return {[this.outputKey]: score};
    }

}
