import { Document } from "@langchain/core/documents";
import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import {
  VectaraStore,
  type VectaraSummary,
  type VectaraFilter,
  DEFAULT_FILTER,
} from "../vectorstores/vectara.js";

export interface VectaraRetrieverInput extends BaseRetrieverInput {
  vectara: VectaraStore;
  filter?: VectaraFilter;
  topK?: number;
  summaryConfig?: VectaraSummary;
}

export class VectaraSummaryRetriever extends BaseRetriever {
  static lc_name() {
    return "VectaraSummaryRetriever";
  }

  lc_namespace = ["langchain", "retrievers"];

  private filter = DEFAULT_FILTER;

  private vectara: VectaraStore;

  private topK: number;

  private summaryConfig: VectaraSummary;

  constructor(fields: VectaraRetrieverInput) {
    super(fields);
    this.vectara = fields.vectara;
    this.topK = fields.topK ?? 10;
    this.filter = fields.filter ?? DEFAULT_FILTER;
    this.summaryConfig = fields.summaryConfig ?? {
      enabled: false,
      maxSummarizedResults: 0,
      responseLang: "eng",
    };
  }

  async _getRelevantDocuments(
    query: string,
    _callbacks?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    const summaryResult = await this.vectara.vectaraQuery(
      query,
      this.topK,
      this.filter,
      this.summaryConfig ? this.summaryConfig : undefined
    );
    const docs = summaryResult.documents;
    if (this.summaryConfig.enabled) {
      docs.push(
        new Document({
          pageContent: summaryResult.summary,
          metadata: { summary: true },
        })
      );
    }
    return docs;
  }
}
