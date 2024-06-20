import { BaseStore } from "@langchain/core/stores";

export interface MediaBlobParameters {
  data?: Blob;

  metadata?: Record<string, unknown>;

  path?: string;
}

/**
 * Represents a chunk of data that can be identified by the path where the
 * data is (or will be) located, along with optional metadata about the data.
 */
export class MediaBlob implements MediaBlobParameters {
  data?: Blob;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;

  path?: string;

  constructor(params?: MediaBlobParameters) {
    this.data = params?.data;
    this.metadata = params?.metadata;
    this.path = params?.path;
  }

  get size(): number {
    return this.data?.size ?? 0;
  }

  get dataType(): string {
    return this.data?.type ?? "";
  }

  get encoding(): string {
    const charsetEquals = this.dataType.indexOf("charset=");
    return charsetEquals === -1
      ? "utf-8"
      : this.dataType.substring(charsetEquals + 8);
  }

  get mimetype(): string {
    const semicolon = this.dataType.indexOf(";");
    return semicolon === -1
      ? this.dataType
      : this.dataType.substring(0, semicolon);
  }

  async asString(): Promise<string> {
    const data = this.data ?? new Blob([]);
    const dataBuffer = await data.arrayBuffer();
    const dataArray = new Uint8Array(dataBuffer);
    return String.fromCharCode(...dataArray);
  }

  async asDataUrl(): Promise<string> {
    const data64 = btoa(await this.asString());
    return `data:${this.mimetype};base64,${data64}`;
  }

  async asUri(): Promise<string> {
    return this.path ?? (await this.asDataUrl());
  }

  async encode(): Promise<{ encoded: string; encoding: string }> {
    const dataUrl = await this.asDataUrl();
    const comma = dataUrl.indexOf(",");
    const encoded = dataUrl.substring(comma + 1);
    const encoding: string = dataUrl.indexOf("base64") > -1 ? "base64" : "8bit";
    return {
      encoded,
      encoding,
    };
  }
}

/**
 * A specialized Store that is designed to handle MediaBlobs and use the
 * key that is included in the blob to determine exactly how it is stored.
 *
 * The full details of a MediaBlob may be changed when it is stored.
 * For example, it may get additional or different Metadata. This should be
 * what is returned when the store() method is called.
 *
 * Although BlobStore extends BaseStore, not all of the methods from
 * BaseStore may be implemented (or even possible). Those that are not
 * implemented should be documented and throw an Error if called.
 */
export abstract class BlobStore extends BaseStore<string, MediaBlob> {
  lc_namespace = ["langchain", "google-common"]; // FIXME - What should this be? And why?

  async _realKey(key: string | MediaBlob): Promise<string> {
    return typeof key === "string" ? key : await key.asUri();
  }

  async store(blob: MediaBlob): Promise<MediaBlob> {
    const key = await blob.asUri();
    await this.mset([[key, blob]]);
    return (await this.fetch(blob)) || blob;
  }

  async fetch(key: string | MediaBlob): Promise<MediaBlob | undefined> {
    const realKey = await this._realKey(key);
    const ret = await this.mget([realKey]);
    return ret?.[0];
  }
}

export class BackedBlobStore extends BlobStore {
  backingStore: BaseStore<string, MediaBlob>;

  constructor(backingStore: BaseStore<string, MediaBlob>) {
    super();
    this.backingStore = backingStore;
  }

  mdelete(keys: string[]): Promise<void> {
    return this.backingStore.mdelete(keys);
  }

  mget(keys: string[]): Promise<(MediaBlob | undefined)[]> {
    return this.backingStore.mget(keys);
  }

  mset(keyValuePairs: [string, MediaBlob][]): Promise<void> {
    return this.backingStore.mset(keyValuePairs);
  }

  yieldKeys(prefix: string | undefined): AsyncGenerator<string> {
    return this.backingStore.yieldKeys(prefix);
  }
}

export class SimpleWebBlobStore extends BlobStore {
  _notImplementedException() {
    throw new Error("Not implemented for SimpleWebBlobStore");
  }

  async _fetch(url: string): Promise<MediaBlob | undefined> {
    const ret = new MediaBlob({
      path: url,
    });
    const metadata: Record<string, unknown> = {};
    const fetchOptions = {
      method: "GET",
    };
    const res = await fetch(url, fetchOptions);
    metadata.status = res.status;

    const headers: Record<string, string> = {};
    for (const [key, value] of res.headers.entries()) {
      headers[key] = value;
    }
    metadata.headers = headers;

    metadata.ok = res.ok;
    if (res.ok) {
      ret.data = await res.blob();
    }

    ret.metadata = metadata;
    return ret;
  }

  async mget(keys: string[]): Promise<(MediaBlob | undefined)[]> {
    const blobMap = keys.map(this._fetch);
    return await Promise.all(blobMap);
  }

  async mdelete(_keys: string[]): Promise<void> {
    this._notImplementedException();
  }

  async mset(_keyValuePairs: [string, MediaBlob][]): Promise<void> {
    this._notImplementedException();
  }

  async *yieldKeys(_prefix: string | undefined): AsyncGenerator<string> {
    this._notImplementedException();
    yield "";
  }
}

export interface MediaManagerConfiguration {
  /**
   * A map from the alias name to the canonical MediaBlob for that name
   */
  aliasStore: BlobStore;

  /**
   * The definitive store for the MediaBlob
   */
  canonicalStore: BlobStore;

  /**
   * BlobStore that can resolve a URL into the MediaBlob to save
   * in the canonical store. A SimpleWebBlobStore is used if not provided.
   */
  resolver?: BlobStore;
}

/**
 * Responsible for converting a URI (typically a web URL) into a MediaBlob.
 * Allows for aliasing / caching of the requested URI and what it resolves to.
 * This MediaBlob is expected to be usable to provide to an LLM, either
 * through the Base64 of the media or through a canonical URI that the LLM
 * supports.
 */
export abstract class MediaManager {

  aliasStore: BlobStore;

  canonicalStore: BlobStore;

  resolver: BlobStore;

  constructor(config: MediaManagerConfiguration) {
    this.aliasStore = config.aliasStore;
    this.canonicalStore = config.canonicalStore;
    this.resolver = config.resolver || new SimpleWebBlobStore();
  }

  /**
   * Given a MediaBlob that has been resolved from the original URL,
   * come up with the path that should be used to store it in
   * the canonical store.
   * @param resolvedBlob
   */
  abstract _getCanonicalPath(resolvedBlob: MediaBlob): string;

  async _isInvalid(blob: MediaBlob | undefined): Promise<boolean> {
    return (typeof blob === "undefined");
  }

  /**
   * Given the non-canonical URI, load what is at this URI and save it
   * in the canonical store.
   * @param uri The URI to resolve using the resolver
   * @return A canonical MediaBlob for this URI
   */
  async _resolveCanonical(uri: string): Promise<MediaBlob> {
    const resolvedBlob = await this.resolver.fetch(uri);
    if (resolvedBlob) {
      const canonicalPath = this._getCanonicalPath(resolvedBlob);
      resolvedBlob.path = canonicalPath;
      const canonicalBlob = await this.canonicalStore.store(resolvedBlob);
      await this.aliasStore.mset([[uri, canonicalBlob]]);
      return canonicalBlob;
    } else {
      return new MediaBlob();
    }
  }

  async getMediaBlob(uri: string): Promise<MediaBlob> {
    const aliasBlob = await this.aliasStore.fetch(uri);
    const ret = await this._isInvalid(aliasBlob)
      ? await this._resolveCanonical(uri)
      : aliasBlob as MediaBlob;
    return ret;
  }
}