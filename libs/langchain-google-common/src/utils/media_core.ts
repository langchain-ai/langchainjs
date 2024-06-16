import {BaseStore} from "@langchain/core/stores";

export interface BlobParameters {

  data?: string | Uint8Array;

  encoding?: string;

  metadata?: Record<string, unknown>;

  mimetype?: string;

  path?: string;

}

export class Blob implements BlobParameters {
  data?: string | Uint8Array;

  encoding: string = "utf-8";

  metadata?: Record<string, unknown>;

  mimetype?: string;

  path?: string;

  constructor(params?: BlobParameters) {
    this.encoding = params?.encoding ?? this.encoding;
    this.data = params?.data;
    this.metadata = params?.metadata;
    this.mimetype = params?.mimetype;
    this.path = params?.path;
  }

  toDataUrl(): string {
    const data = this.data ?? "";
    const data64 = typeof data === 'string'
      ? btoa(data)
      : btoa(String.fromCharCode(...data));
    const mimetype = this.mimetype ?? "application/octet-stream";
    return `data:${mimetype};base64,${data64}`;
  }

  toUri(): string {
    return this.path ?? this.toDataUrl();
  }

}

export abstract class BlobStore extends BaseStore<string, Blob> {
  lc_namespace = ["langchain", "google-common"];  // FIXME - What should this be? And why?

  _realKey(key: string | Blob): string {
    return typeof key === 'string'
      ? key
      : key.toUri();
  }

  async store(blob: Blob): Promise<Blob> {
    const key = blob.toUri();
    await this.mset([[key, blob]]);
    return blob;
  }

  async fetch(key: string | Blob): Promise<Blob | undefined> {
    const realKey = this._realKey(key);
    const ret = await this.mget([realKey])
    return ret?.[0];
  }

}

export class BackedBlobStore extends BlobStore {

  backingStore: BaseStore<string, Blob>;

  constructor(backingStore: BaseStore<string, Blob>) {
    super();
    this.backingStore = backingStore;
  }

  mdelete(keys: string[]): Promise<void> {
    return this.backingStore.mdelete(keys);
  }

  mget(keys: string[]): Promise<(Blob | undefined)[]> {
    return this.backingStore.mget(keys);
  }

  mset(keyValuePairs: [string, Blob][]): Promise<void> {
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

  async _fetch(url: string): Promise<Blob | undefined> {
    const ret = new Blob({
      path: url,
    });
    const metadata: Record<string,unknown> = {};
    const fetchOptions = {
      method: "GET",
    }
    const res = await fetch(url, fetchOptions);
    metadata.status = res.status;

    const headers: Record<string,string> = {};
    for (const [key,value] of res.headers.entries()) {
      headers[key] = value;
    }
    metadata.headers = headers;

    metadata.ok = res.ok;
    if (res.ok) {
      ret.data = await res.text();

      const mimetype = res.headers.get("Content-Type") || "application/octet-stream";
      const colon = mimetype.indexOf(";")
      if (colon < 0) {
        ret.mimetype = mimetype;
      } else {
        ret.mimetype = mimetype.substring(0, colon);
        const charsetIndex = mimetype.indexOf("charset=");
        if (charsetIndex > -1) {
          ret.encoding = mimetype.substring(charsetIndex+8);
        }
      }
    }

    ret.metadata = metadata;
    return ret;
  }

  async mget(keys: string[]): Promise<(Blob | undefined)[]> {
    const blobMap = keys.map(this._fetch);
    return await Promise.all(blobMap);
  }

  async mdelete(_keys: string[]): Promise<void> {
    this._notImplementedException();
  }

  async mset(_keyValuePairs: [string, Blob][]): Promise<void> {
    this._notImplementedException();
  }

  async *yieldKeys(_prefix: string | undefined): AsyncGenerator<string> {
    this._notImplementedException();
    yield "";
  }

}

