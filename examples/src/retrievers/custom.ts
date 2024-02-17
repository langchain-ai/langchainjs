import {
  BaseRetriever,
  type BaseRetrieverInput,
} from "@langchain/core/retrievers";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Document } from "@langchain/core/documents";

/**
 * interface BaseRetrieverInput {
 *   callbacks?: Callbacks;
 *   tags?: string[];
 *   metadata?: Record<string, unknown>;
 *   verbose?: boolean;
 * }
 */
export interface CustomRetrieverInput extends BaseRetrieverInput {}

export class CustomRetriever extends BaseRetriever {
  lc_namespace = ["langchain", "retrievers"];

  constructor(fields?: CustomRetrieverInput) {
    super(fields);
  }

  async _getRelevantDocuments(
    query: string,
    // Use with sub runs for tracing
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    // You can invoke other runnables like this to pass tracing config through:
    // const additionalDocs = await someOtherRunnable.invoke({}, runManager?.getChild());
    return [
      // ...additionalDocs,
      new Document({
        pageContent: `Some document pertaining to ${query}`,
        metadata: {},
      }),
      new Document({
        pageContent: `Some other document pertaining to ${query}`,
        metadata: {},
      }),
    ];
  }
}

const retriever = new CustomRetriever({});

console.log(await retriever.invoke("LangChain docs"));
