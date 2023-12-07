import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";
import {
  AsyncCaller,
  type AsyncCallerParams,
} from "@langchain/core/utils/async_caller";

export interface ChaindeskRetrieverArgs
  extends AsyncCallerParams,
    BaseRetrieverInput {
  datastoreId: string;
  topK?: number;
  filter?: Record<string, unknown>;
  apiKey?: string;
}

interface Berry {
  text: string;
  score: number;
  source?: string;
  [key: string]: unknown;
}

/**
 * @example
 * ```typescript
 * const retriever = new ChaindeskRetriever({
 *   datastoreId: "DATASTORE_ID",
 *   apiKey: "CHAINDESK_API_KEY",
 *   topK: 8,
 * });
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class ChaindeskRetriever extends BaseRetriever {
  static lc_name() {
    return "ChaindeskRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "chaindesk"];

  caller: AsyncCaller;

  datastoreId: string;

  topK?: number;

  filter?: Record<string, unknown>;

  apiKey?: string;

  constructor({
    datastoreId,
    apiKey,
    topK,
    filter,
    ...rest
  }: ChaindeskRetrieverArgs) {
    super();

    this.caller = new AsyncCaller(rest);
    this.datastoreId = datastoreId;
    this.apiKey = apiKey;
    this.topK = topK;
    this.filter = filter;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const r = await this.caller.call(
      fetch,
      `https://app.chaindesk.ai/api/datastores/${this.datastoreId}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          query,
          ...(this.topK ? { topK: this.topK } : {}),
          ...(this.filter ? { filters: this.filter } : {}),
        }),
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      }
    );

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
