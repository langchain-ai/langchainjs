import { expect } from "@jest/globals";

import {
  ICacheClient,
  IMomentoCache,
  CacheDelete,
  CacheGet,
  CacheIncrement,
  CacheKeyExists,
  CacheKeysExist,
  CacheSet,
  CacheSetIfNotExists,
  CacheSetFetch,
  CacheSetAddElements,
  CacheSetAddElement,
  CacheSetRemoveElements,
  CacheSetRemoveElement,
  CacheListFetch,
  CacheListLength,
  CacheListPushFront,
  CacheListPushBack,
  CacheListConcatenateBack,
  CacheListConcatenateFront,
  CacheListPopBack,
  CacheListPopFront,
  CacheListRemoveValue,
  CacheListRetain,
  CacheDictionarySetField,
  CacheDictionarySetFields,
  CacheDictionaryGetField,
  CacheDictionaryGetFields,
  CacheDictionaryFetch,
  CacheDictionaryLength,
  CacheDictionaryIncrement,
  CacheDictionaryRemoveField,
  CacheDictionaryRemoveFields,
  CacheSortedSetFetch,
  CacheSortedSetPutElement,
  CacheSortedSetPutElements,
  CacheSortedSetGetRank,
  CacheSortedSetGetScore,
  CacheSortedSetGetScores,
  CacheSortedSetLength,
  CacheSortedSetLengthByScore,
  CacheSortedSetIncrementScore,
  CacheSortedSetRemoveElement,
  CacheItemGetType,
  CacheItemGetTtl,
  CreateCache,
  ListCaches,
  DeleteCache,
  CacheFlush,
  CacheUpdateTtl,
  CacheIncreaseTtl,
  CacheDecreaseTtl,
} from "@gomomento/sdk-core";
import { Generation } from "@langchain/core/outputs";

import { MomentoCache } from "../momento.js";

class MockClient implements ICacheClient {
  private _cache: Map<string, string>;

  constructor() {
    this._cache = new Map();
  }

  cache(): IMomentoCache {
    throw new Error("Method not implemented.");
  }

  public async get(_: string, key: string): Promise<CacheGet.Response> {
    if (this._cache.has(key)) {
      return new CacheGet.Hit(new TextEncoder().encode(this._cache.get(key)));
    } else {
      return new CacheGet.Miss();
    }
  }

  public async set(
    _: string,
    key: string,
    value: string
  ): Promise<CacheSet.Response> {
    this._cache.set(key, value);
    return new CacheSet.Success();
  }

  public async createCache(): Promise<CreateCache.Response> {
    return new CreateCache.Success();
  }

  deleteCache(): Promise<DeleteCache.Response> {
    throw new Error("Method not implemented.");
  }

  listCaches(): Promise<ListCaches.Response> {
    throw new Error("Method not implemented.");
  }

  flushCache(): Promise<CacheFlush.Response> {
    throw new Error("Method not implemented.");
  }

  ping(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  delete(): Promise<CacheDelete.Response> {
    throw new Error("Method not implemented.");
  }

  increment(): Promise<CacheIncrement.Response> {
    throw new Error("Method not implemented.");
  }

  keyExists(): Promise<CacheKeyExists.Response> {
    throw new Error("Method not implemented.");
  }

  keysExist(): Promise<CacheKeysExist.Response> {
    throw new Error("Method not implemented.");
  }

  setIfNotExists(): Promise<CacheSetIfNotExists.Response> {
    throw new Error("Method not implemented.");
  }

  setFetch(): Promise<CacheSetFetch.Response> {
    throw new Error("Method not implemented.");
  }

  setAddElement(): Promise<CacheSetAddElement.Response> {
    throw new Error("Method not implemented.");
  }

  setAddElements(): Promise<CacheSetAddElements.Response> {
    throw new Error("Method not implemented.");
  }

  setRemoveElement(): Promise<CacheSetRemoveElement.Response> {
    throw new Error("Method not implemented.");
  }

  setRemoveElements(): Promise<CacheSetRemoveElements.Response> {
    throw new Error("Method not implemented.");
  }

  listFetch(): Promise<CacheListFetch.Response> {
    throw new Error("Method not implemented.");
  }

  listLength(): Promise<CacheListLength.Response> {
    throw new Error("Method not implemented.");
  }

  listPushFront(): Promise<CacheListPushFront.Response> {
    throw new Error("Method not implemented.");
  }

  listPushBack(): Promise<CacheListPushBack.Response> {
    throw new Error("Method not implemented.");
  }

  listConcatenateBack(): Promise<CacheListConcatenateBack.Response> {
    throw new Error("Method not implemented.");
  }

  listConcatenateFront(): Promise<CacheListConcatenateFront.Response> {
    throw new Error("Method not implemented.");
  }

  listPopBack(): Promise<CacheListPopBack.Response> {
    throw new Error("Method not implemented.");
  }

  listPopFront(): Promise<CacheListPopFront.Response> {
    throw new Error("Method not implemented.");
  }

  listRemoveValue(): Promise<CacheListRemoveValue.Response> {
    throw new Error("Method not implemented.");
  }

  listRetain(): Promise<CacheListRetain.Response> {
    throw new Error("Method not implemented.");
  }

  dictionarySetField(): Promise<CacheDictionarySetField.Response> {
    throw new Error("Method not implemented.");
  }

  dictionarySetFields(): Promise<CacheDictionarySetFields.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryGetField(): Promise<CacheDictionaryGetField.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryGetFields(): Promise<CacheDictionaryGetFields.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryFetch(): Promise<CacheDictionaryFetch.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryIncrement(): Promise<CacheDictionaryIncrement.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryLength(): Promise<CacheDictionaryLength.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryRemoveField(): Promise<CacheDictionaryRemoveField.Response> {
    throw new Error("Method not implemented.");
  }

  dictionaryRemoveFields(): Promise<CacheDictionaryRemoveFields.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetFetchByRank(): Promise<CacheSortedSetFetch.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetFetchByScore(): Promise<CacheSortedSetFetch.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetPutElement(): Promise<CacheSortedSetPutElement.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetPutElements(): Promise<CacheSortedSetPutElements.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetGetRank(): Promise<CacheSortedSetGetRank.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetGetScore(): Promise<CacheSortedSetGetScore.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetGetScores(): Promise<CacheSortedSetGetScores.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetIncrementScore(): Promise<CacheSortedSetIncrementScore.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetLength(): Promise<CacheSortedSetLength.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetLengthByScore(): Promise<CacheSortedSetLengthByScore.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetRemoveElement(): Promise<CacheSortedSetRemoveElement.Response> {
    throw new Error("Method not implemented.");
  }

  sortedSetRemoveElements(): Promise<CacheSortedSetRemoveElement.Response> {
    throw new Error("Method not implemented.");
  }

  itemGetType(): Promise<CacheItemGetType.Response> {
    throw new Error("Method not implemented.");
  }

  itemGetTtl(): Promise<CacheItemGetTtl.Response> {
    throw new Error("Method not implemented.");
  }

  updateTtl(): Promise<CacheUpdateTtl.Response> {
    throw new Error("Method not implemented.");
  }

  increaseTtl(): Promise<CacheIncreaseTtl.Response> {
    throw new Error("Method not implemented.");
  }

  decreaseTtl(): Promise<CacheDecreaseTtl.Response> {
    throw new Error("Method not implemented.");
  }
}

describe("MomentoCache", () => {
  it("should return null on a cache miss", async () => {
    const client = new MockClient();
    const cache = await MomentoCache.fromProps({
      client,
      cacheName: "test-cache",
    });
    expect(await cache.lookup("prompt", "llm-key")).toBeNull();
  });

  it("should get a stored value", async () => {
    const client = new MockClient();
    const cache = await MomentoCache.fromProps({
      client,
      cacheName: "test-cache",
    });
    const generations: Generation[] = [{ text: "foo" }];
    await cache.update("prompt", "llm-key", generations);
    expect(await cache.lookup("prompt", "llm-key")).toStrictEqual(generations);
  });

  it("should work with multiple generations", async () => {
    const client = new MockClient();
    const cache = await MomentoCache.fromProps({
      client,
      cacheName: "test-cache",
    });
    const generations: Generation[] = [
      { text: "foo" },
      { text: "bar" },
      { text: "baz" },
    ];
    await cache.update("prompt", "llm-key", generations);
    expect(await cache.lookup("prompt", "llm-key")).toStrictEqual(generations);
  });
});
