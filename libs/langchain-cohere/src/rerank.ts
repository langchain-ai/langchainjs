import { DocumentInterface } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { CohereClient } from "cohere-ai";

export interface CohereRerankArgs {
  /**
   * The API key to use.
   * @default {process.env.COHERE_API_KEY}
   */
  apiKey?: string;
  /**
   * The name of the model to use.
   * @default {"rerank-english-v2.0"}
   */
  model?: string;
  /**
   * How many documents to return.
   * @default {3}
   */
  topN?: number;
}

/**
 * Document compressor that uses `Cohere Rerank API`.
 */
export class CohereRerank {
  model = "rerank-english-v2.0";

  topN = 3;

  client: CohereClient;

  constructor(fields: CohereRerankArgs) {
    const token = fields?.apiKey ?? getEnvironmentVariable("COHERE_API_KEY");
    if (!token) {
      throw new Error("No API key provided for CohereRerank.");
    }

    this.client = new CohereClient({
      token,
    });
    this.model = fields.model ?? this.model;
    this.topN = fields.topN ?? this.topN;
  }

  /**
   * Compress documents using Cohere's rerank API.
   *
   * @param {Array<DocumentInterface>} documents A sequence of documents to compress.
   * @param {string} query The query to use for compressing the documents.
   *
   * @returns {Promise<Array<DocumentInterface>>} A sequence of compressed documents.
   */
  async compressDocuments(
    documents: Array<DocumentInterface>,
    query: string
  ): Promise<Array<DocumentInterface>> {
    const _docs = documents.map((doc) => doc.pageContent);
    const { results } = await this.client.rerank({
      model: this.model,
      query,
      documents: _docs,
      topN: this.topN,
    });
    const finalResults: Array<DocumentInterface> = [];
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const doc = documents[result.index];
      doc.metadata.relevanceScore = result.relevanceScore;
      finalResults.push(doc);
    }
    return finalResults;
  }
}
