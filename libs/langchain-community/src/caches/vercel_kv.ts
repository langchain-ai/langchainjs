import { kv, type VercelKV } from "@vercel/kv";

import { Generation } from "@langchain/core/outputs";
import {
  BaseCache,
  deserializeStoredGeneration,
  getCacheKey,
  serializeGeneration,
} from "@langchain/core/caches";
import { StoredGeneration } from "@langchain/core/messages";

export type VercelKVCacheProps = {
  /**
   * An existing Vercel KV client
   */
  client?: VercelKV;
  /**
   * Time-to-live (TTL) for cached items in seconds
   */
  ttl?: number;
};

/**
 * A cache that uses Vercel KV as the backing store.
 * @example
 * ```typescript
 * const cache = new VercelKVCache({
 *   ttl: 3600, // Optional: Cache entries will expire after 1 hour
 * });
 *
 * // Initialize the OpenAI model with Vercel KV cache for caching responses
 * const model = new ChatOpenAI({
 *   model: "gpt-4o-mini",
 *   cache,
 * });
 * await model.invoke("How are you today?");
 * const cachedValues = await cache.lookup("How are you today?", "llmKey");
 * ```
 */
export class VercelKVCache extends BaseCache {
  private client: VercelKV;

  private ttl?: number;

  constructor(props: VercelKVCacheProps) {
    super();
    const { client, ttl } = props;
    this.client = client ?? kv;
    this.ttl = ttl;
  }

  /**
   * Lookup LLM generations in cache by prompt and associated LLM key.
   */
  public async lookup(prompt: string, llmKey: string) {
    let idx = 0;
    let key = getCacheKey(prompt, llmKey, String(idx));
    let value = await this.client.get<StoredGeneration | null>(key);
    const generations: Generation[] = [];

    while (value) {
      generations.push(deserializeStoredGeneration(value));
      idx += 1;
      key = getCacheKey(prompt, llmKey, String(idx));
      value = await this.client.get<StoredGeneration | null>(key);
    }

    return generations.length > 0 ? generations : null;
  }

  /**
   * Update the cache with the given generations.
   *
   * Note this overwrites any existing generations for the given prompt and LLM key.
   */
  public async update(prompt: string, llmKey: string, value: Generation[]) {
    for (let i = 0; i < value.length; i += 1) {
      const key = getCacheKey(prompt, llmKey, String(i));
      const serializedValue = JSON.stringify(serializeGeneration(value[i]));

      if (this.ttl) {
        await this.client.set(key, serializedValue, { ex: this.ttl });
      } else {
        await this.client.set(key, serializedValue);
      }
    }
  }
}
