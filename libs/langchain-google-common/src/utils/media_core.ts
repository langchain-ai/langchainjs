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
