import { ZkStash } from "@zkstash/sdk/rest";

import { Document } from "@langchain/core/documents";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";

/**
 * Interface for the fields required during the initialization of a
 * `ZkStashRetriever` instance.
 */
export interface ZkStashRetrieverFields extends BaseRetrieverInput {
  /**
   * Existing zkStash client.
   */
  client?: ZkStash;
  /**
   * API Key for zkStash. If provided, client will be created automatically.
   */
  apiKey?: string;
  /**
   * Base URL for the zkStash API.
   * @default "https://api.zkstash.ai"
   */
  baseUrl?: string;
  /**
   * Filters to apply to every search.
   * `agentId` is required to scope the search.
   */
  filters: {
    agentId: string;
    threadId?: string;
    kind?: string;
    tags?: string[];
  };
  /**
   * Search mode for zkStash.
   * - "raw": Returns the raw data (default).
   * - "answer": Uses LLM to synthesize an answer from the memories.
   * - "map": Returns a mapped representation.
   * @default "raw"
   */
  mode?: "raw" | "answer" | "map";
}

/**
 * ZkStash retriever integration.
 *
 * This retriever uses zkStash's semantic search to pull relevant structured memories
 * as LangChain Documents. It's ideally suited for Long-Term Memory (LTM) retrieval
 * in RAG applications and autonomous agents.
 */
export class ZkStashRetriever extends BaseRetriever {
  static lc_name(): string {
    return "ZkStashRetriever";
  }

  lc_namespace = ["langchain", "retrievers", "zkstash"];

  private client: ZkStash;

  private filters: ZkStashRetrieverFields["filters"];

  private mode: ZkStashRetrieverFields["mode"];

  constructor(fields: ZkStashRetrieverFields) {
    super(fields);
    this.filters = fields.filters;
    this.mode = fields.mode ?? "raw";

    if (fields.client) {
      this.client = fields.client;
    } else if (fields.apiKey) {
      this.client = new ZkStash({ apiKey: fields.apiKey, baseUrl: fields.baseUrl });
    } else {
      throw new Error("Either client or apiKey must be provided to ZkStashRetriever.");
    }
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const resultsRaw = await this.client.searchMemories({
      query,
      mode: this.mode,
      filters: this.filters,
    });

    const memories = Array.isArray(resultsRaw) 
      ? resultsRaw 
      : (resultsRaw as any)?.memories ?? [];

    if (!Array.isArray(memories)) {
      return [];
    }

    return memories.map((result: any) => {
      // Use 'metadata' as the primary source of structured data if 'data' is missing
      const data = result.data ?? result.metadata;
      const pageContent = typeof data === 'string' 
        ? data 
        : JSON.stringify(data);
      
      const { data: _data, ...metadata } = result;
      
      return new Document({
        pageContent,
        metadata: {
          ...metadata,
          source: "zkstash",
        },
      });
    });
  }
}
