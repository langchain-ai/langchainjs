import Metal from "@getmetal/metal-sdk";

import { BaseRetriever, BaseRetrieverInput } from "@langchain/core/retrievers";
import { Document } from "@langchain/core/documents";

/**
 * Interface for the fields required during the initialization of a
 * `MetalRetriever` instance. It extends the `BaseRetrieverInput`
 * interface and adds a `client` field of type `Metal`.
 */
export interface MetalRetrieverFields extends BaseRetrieverInput {
  client: Metal;
}

/**
 * Interface to represent a response item from the Metal service. It
 * contains a `text` field and an index signature to allow for additional
 * unknown properties.
 */
interface ResponseItem {
  text: string;
  [key: string]: unknown;
}

/**
 * Class used to interact with the Metal service, a managed retrieval &
 * memory platform. It allows you to index your data into Metal and run
 * semantic search and retrieval on it. It extends the `BaseRetriever`
 * class and requires a `Metal` instance and a dictionary of parameters to
 * pass to the Metal API during its initialization.
 * @example
 * ```typescript
 * const retriever = new MetalRetriever({
 *   client: new Metal(
 *     process.env.METAL_API_KEY,
 *     process.env.METAL_CLIENT_ID,
 *     process.env.METAL_INDEX_ID,
 *   ),
 * });
 * const docs = await retriever.getRelevantDocuments("hello");
 * ```
 */
export class MetalRetriever extends BaseRetriever {
  static lc_name() {
    return "MetalRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "metal"];

  private client: Metal;

  constructor(fields: MetalRetrieverFields) {
    super(fields);

    this.client = fields.client;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const res = await this.client.search({ text: query });

    const items = ("data" in res ? res.data : res) as ResponseItem[];
    return items.map(
      ({ text, metadata }) =>
        new Document({
          pageContent: text,
          metadata: metadata as Record<string, unknown>,
        })
    );
  }
}
