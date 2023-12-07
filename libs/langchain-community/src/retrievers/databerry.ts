import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";

/**
 * Interface for the arguments required to create a new instance of
 * DataberryRetriever.
 */
export interface DataberryRetrieverArgs
  extends AsyncCallerParams,
    BaseRetrieverInput {
  datastoreUrl: string;
  topK?: number;
  apiKey?: string;
}

/**
 * Interface for the structure of a Berry object returned by the Databerry
 * API.
 */
interface Berry {
  text: string;
  score: number;
  source?: string;
  [key: string]: unknown;
}

/**
 * A specific implementation of a document retriever for the Databerry
 * API. It extends the BaseRetriever class, which is an abstract base
 * class for a document retrieval system in LangChain.
 */
/** @deprecated Use "langchain/retrievers/chaindesk" instead */
export class DataberryRetriever extends BaseRetriever {
  static lc_name() {
    return "DataberryRetriever";
  }

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
