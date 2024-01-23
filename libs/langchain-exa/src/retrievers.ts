import Exa from "exa-js";

import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the fields required during the initialization of a
 * `ExaRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `Exa`.
 */
export interface ExaRetrieverFields extends BaseRetrieverInput {
  client: Exa;
}

/**
 * @example
 * ```typescript
 * const retriever = new ExaRetriever({
 *   client: new Exa(
 *     process.env.EXA_API_KEY,
 *     process.env.EXA_BASE_URL,
 *   ),
 * });
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class ExaRetriever extends BaseRetriever {
  static lc_name() {
    return "ExaRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "exa"];

  private client: Exa;

  constructor(fields: ExaRetrieverFields) {
    super(fields);

    this.client = fields.client;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res = await this.client.searchAndContents(query);
    console.log(res);
    throw new Error("todo implement");
  }
}
