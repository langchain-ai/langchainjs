import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";

export interface EnsembleRetrieverInput extends BaseRetrieverInput {
  retrievers: BaseRetriever[];
  weights?: number[];
  c?: number;
}

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
    this.weights = args.weights || new Array(args.retrievers.length).fill(1 / args.retrievers.length);
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
    const retrieverDocs = [];
    for (const retriever of this.retrievers) {
      const res = await retriever.invoke(query, {
        callbacks: runManager?.getChild(),
      });
      retrieverDocs.push(res);
    }

    const fusedDocs = await this._weightedReciprocalRank(retrieverDocs);
    return fusedDocs;
  }

  async _weightedReciprocalRank(docList:DocumentInterface[][]) {
    if (docList.length !== this.weights.length) {
      throw new Error('Number of rank lists must be equal to the number of weights.')
    }

    const rrfSocreDict = docList.reduce((rffScore, retriever_doc, idx) => {
      let rank = 1;
      const weight = this.weights[idx];
      while (rank <= retriever_doc.length) {
        const {pageContent} = retriever_doc[rank - 1];
        if (!rffScore[pageContent]) {
          // eslint-disable-next-line no-param-reassign
          rffScore[pageContent] = 0;
        } 
        // eslint-disable-next-line no-param-reassign
        rffScore[pageContent] += weight / (rank + this.c);
        rank += 1;
      }

      return rffScore;
    }, {} as Record<string, number>);
     
    const uniqueDocs = this._uniqueUnion(docList.flat());
    const sortedDocs = Array.from(uniqueDocs).sort((a, b) => rrfSocreDict[b.pageContent] - rrfSocreDict[a.pageContent]);

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
