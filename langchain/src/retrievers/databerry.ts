import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { Document } from "../document.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export interface DataberryRetrieverArgs
  extends AsyncCallerParams,
    BaseRetrieverInput {
  datastoreUrl: string;
  topK?: number;
  apiKey?: string;
}

interface Berry {
  text: string;
  score: number;
  source?: string;
  [key: string]: unknown;
}

export class DataberryRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers", "databerry"];

  get lc_secrets() {
    return { apiKey: "DATABERRY_API_KEY" };
  }

  get lc_aliases() {
    return { apiKey: "api_key" };
  }

  caller: AsyncCaller;

  datastoreUrl: string;

  topK?: number;

  apiKey?: string;

  constructor(fields: DataberryRetrieverArgs) {
    super(fields);
    const { datastoreUrl, apiKey, topK, ...rest } = fields;

    this.caller = new AsyncCaller(rest);
    this.datastoreUrl = datastoreUrl;
    this.apiKey = apiKey;
    this.topK = topK;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const r = await this.caller.call(fetch, this.datastoreUrl, {
      method: "POST",
      body: JSON.stringify({
        query,
        ...(this.topK ? { topK: this.topK } : {}),
      }),
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
    });

    const { results } = (await r.json()) as { results: Berry[] };

    return results.map(
      ({ text, score, source, ...rest }) =>
        new Document({
          pageContent: text,
          metadata: {
            score,
            source,
            ...rest,
          },
        })
    );
  }
}
