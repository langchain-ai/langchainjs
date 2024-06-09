import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";

export interface EnsembleRetrieverInput extends BaseRetrieverInput {
  /** A list of retrievers to ensemble. */
  retrievers: BaseRetriever[];
  /**
   * A list of weights corresponding to the retrievers. Defaults to equal
   * weighting for all retrievers.
   */
  weights?: number[];
  /**
   * A constant added to the rank, controlling the balance between the importance
   * of high-ranked items and the consideration given to lower-ranked items.
   * Default is 60.
   */
  c?: number;
}

/**
 * Ensemble retriever that aggregates and orders the results of
 * multiple retrievers by using weighted Reciprocal Rank Fusion.
 */
export class EnsembleRetriever extends BaseRetriever {
  static lc_name() {
    return "EnsembleRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "ensemble_retriever"];

  retrievers: BaseRetriever[];

  weights: number[];

  c = 60;

  constructor(args: EnsembleRetrieverInput) {
    super(args);
    this.retrievers = args.retrievers;
    this.weights =
      args.weights ||
      new Array(args.retrievers.length).fill(1 / args.retrievers.length);
    this.c = args.c || 60;
  }

  async _getRelevantDocuments(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ) {
    return this._rankFusion(query, runManager);
  }

  async _rankFusion(
    query: string,
    runManager?: CallbackManagerForRetrieverRun
  ) {
    const retrieverDocs = await Promise.all(
      this.retrievers.map((retriever, i) =>
        retriever.invoke(query, {
          callbacks: runManager?.getChild(`retriever_${i + 1}`),
        })
      )
    );

    const fusedDocs = await this._weightedReciprocalRank(retrieverDocs);
    return fusedDocs;
  }

  async _weightedReciprocalRank(docList: DocumentInterface[][]) {
    if (docList.length !== this.weights.length) {
      throw new Error(
        "Number of retrieved document lists must be equal to the number of weights."
      );
    }

    const rrfScoreDict = docList.reduce(
      (rffScore: Record<string, number>, retrieverDoc, idx) => {
        let rank = 1;
        const weight = this.weights[idx];
        while (rank <= retrieverDoc.length) {
          const { pageContent } = retrieverDoc[rank - 1];
          if (!rffScore[pageContent]) {
            // eslint-disable-next-line no-param-reassign
            rffScore[pageContent] = 0;
          }
          // eslint-disable-next-line no-param-reassign
          rffScore[pageContent] += weight / (rank + this.c);
          rank += 1;
        }

        return rffScore;
      },
      {}
    );

    const uniqueDocs = this._uniqueUnion(docList.flat());
    const sortedDocs = Array.from(uniqueDocs).sort(
      (a, b) => rrfScoreDict[b.pageContent] - rrfScoreDict[a.pageContent]
    );

    return sortedDocs;
  }

  private _uniqueUnion(documents: Document[]): Document[] {
    const documentSet = new Set();
    const result = [];

    for (const doc of documents) {
      const key = doc.pageContent;
      if (!documentSet.has(key)) {
        documentSet.add(key);
        result.push(doc);
      }
    }

    return result;
  }
}
