import Metal from "@getmetal/metal-sdk";

import { BaseRetriever, BaseRetrieverInput } from "../schema/retriever.js";
import { Document } from "../document.js";

export interface MetalRetrieverFields extends BaseRetrieverInput {
  client: Metal;
}

interface ResponseItem {
  text: string;
  [key: string]: unknown;
}

export class MetalRetriever extends BaseRetriever {
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
