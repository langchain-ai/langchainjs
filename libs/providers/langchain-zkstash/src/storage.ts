import { ZkStash } from "@zkstash/sdk/rest";
import { BaseStore } from "@langchain/core/stores";

/**
 * ZkStash storage implementation.
 *
 * This class implements the `BaseStore` interface, where each 'Key' maps directly
 * to a zkStash 'Schema' (Kind). This allows zkStash to act as a Managed 
 * Structural Knowledge Store.
 *
 * Each mget/mset operation targets the specific schema named by the key,
 * scoped to the provided agentId and optional threadId.
 */
export class ZkStashStore extends BaseStore<string, any> {
  lc_namespace = ["langchain", "storage", "zkstash"];

  private client: ZkStash;

  private agentId: string;

  private threadId?: string;

  constructor(fields: { 
    client?: ZkStash; 
    apiKey?: string; 
    baseUrl?: string; 
    agentId: string;
    threadId?: string;
  }) {
    super(fields);
    this.agentId = fields.agentId;
    this.threadId = fields.threadId;

    if (fields.client) {
      this.client = fields.client;
    } else if (fields.apiKey) {
      this.client = new ZkStash({ apiKey: fields.apiKey, baseUrl: fields.baseUrl });
    } else {
      throw new Error("Either client or apiKey must be provided to ZkStashStore.");
    }
  }

  /**
   * Retrieves specific memory records by their Schema (Kind).
   * Maps to the latest record of that Kind in zkStash.
   */
  async mget(keys: string[]): Promise<(any | undefined)[]> {
    return Promise.all(keys.map(async (key) => {
      const resultsRaw = await this.client.searchMemories({
        query: "latest", // Use a generic query to fetch the most relevant (latest) record
        filters: { 
          agentId: this.agentId, 
          threadId: this.threadId,
          kind: key 
        },
        mode: "raw"
      });
      
      const memories = Array.isArray(resultsRaw) 
        ? resultsRaw 
        : (resultsRaw as any)?.memories ?? [];
      
      const records = Array.isArray(memories) ? memories : [];
      // Return the underlying data of the most recent memory for this schema.
      // We check both result.data and result.metadata for broad compatibility.
      const latestRecord = records[0];
      if (!latestRecord) return undefined;

      return latestRecord.data ?? latestRecord.metadata;
    }));
  }

  /**
   * Stores structured data in zkStash by triggering extraction into a specific Schema (Key).
   */
  async mset(keyValuePairs: [string, any][]): Promise<void> {
    await Promise.all(keyValuePairs.map(async ([key, value]) => {
      await this.client.createMemory({
        agentId: this.agentId,
        threadId: this.threadId,
        schemas: [key], // Map the Key to the Schema
        conversation: [
          { role: "user", content: `The following information about ${key} is true: ${JSON.stringify(value)}` },
          { role: "assistant", content: `I will remember that information for ${key}.` }
        ]
      });
    }));
  }

  async mdelete(_keys: string[]): Promise<void> {
    throw new Error("Bulk deletion not yet implemented in ZkStashStore. Use zkstash-sdk directly for memory lifecycle management.");
  }

  async *yieldKeys(_prefix?: string): AsyncGenerator<string> {
   throw new Error("Key enumeration (Schema listing) not yet implemented in ZkStashStore yieldKeys. Use listSchemas() on the client instead.");
  }

  /**
   * Semantic search across memories.
   * If a kind is provided, it searches within that schema.
   */
  async search(query: string, options?: { kind?: string; tags?: string[] }): Promise<any[]> {
    const resultsRaw = await this.client.searchMemories({
      query,
      filters: {
        agentId: this.agentId,
        threadId: this.threadId,
        kind: options?.kind,
        tags: options?.tags,
      },
      mode: "raw"
    });

    const memories = Array.isArray(resultsRaw) 
      ? resultsRaw 
      : (resultsRaw as any)?.memories ?? [];

    return Array.isArray(memories) ? memories : [];
  }
}
