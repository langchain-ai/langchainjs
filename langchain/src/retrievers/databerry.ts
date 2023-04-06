import { BaseRetriever } from "../schema/index.js";
import { Document } from "../document.js";

interface DataberryRetrieverArgs {
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
  datastoreUrl: string;

  topK?: number;

  apiKey?: string;

  constructor({ datastoreUrl, apiKey, topK }: DataberryRetrieverArgs) {
    super();

    this.datastoreUrl = datastoreUrl;
    this.apiKey = apiKey;
    this.topK = topK;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    const r = await fetch(this.datastoreUrl, {
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
