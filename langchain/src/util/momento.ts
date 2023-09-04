/* eslint-disable no-instanceof/no-instanceof */
import { ICacheClient, CreateCache } from "@gomomento/sdk";

/**
 * Utility function to ensure that a Momento cache exists.
 * If the cache does not exist, it is created.
 *
 * @param client The Momento cache client.
 * @param cacheName The name of the cache to ensure exists.
 */
export async function ensureCacheExists(
  client: ICacheClient,
  cacheName: string
): Promise<void> {
  const createResponse = await client.createCache(cacheName);
  if (
    createResponse instanceof CreateCache.Success ||
    createResponse instanceof CreateCache.AlreadyExists
  ) {
    // pass
  } else if (createResponse instanceof CreateCache.Error) {
    throw createResponse.innerException();
  } else {
    throw new Error(`Unknown response type: ${createResponse.toString()}`);
  }
}
