import {BaseStore} from "@langchain/core/stores";

export interface MediaBlobParameters {

  data?: Blob;

  metadata?: Record<string, unknown>;

  path?: string;

}

export class MediaBlob implements MediaBlobParameters {
  data?: Blob;

  metadata?: Record<string, unknown>;

  path?: string;

  constructor(params?: MediaBlobParameters) {
    this.data = params?.data;
    this.metadata = params?.metadata;
    this.path = params?.path;
  }

  get dataType(): string {
    return this.data?.type ?? "";
  }

  get encoding(): string {
    const charsetEquals = this.dataType.indexOf("charset=");
    return charsetEquals === -1
      ? "utf-8"
      : this.dataType.substring(charsetEquals+8);
  }

  get mimetype(): string {
    const semicolon = this.dataType.indexOf(";");
    return semicolon === -1
      ? this.dataType
      : this.dataType.substring(0, semicolon);
  }

  /*
   * Based on https://stackoverflow.com/a/67551175/1405634
   */
  async toDataUrl(): Promise<string> {
    const data = this.data ?? new Blob([]);
    const dataBuffer = await data.arrayBuffer();
    const dataArray = new Uint8Array(dataBuffer);
    const data64 = btoa(String.fromCharCode(...dataArray));
    return `data:${this.mimetype};base64,${data64}`;
  }

  async toUri(): Promise<string> {
    return this.path ?? await this.toDataUrl();
  }

  async encode(): Promise<{encoded: string, encoding: string}> {
    const dataUrl = await this.toDataUrl();
    const comma = dataUrl.indexOf(',');
    const encoded = dataUrl.substring(comma+1);
    const encoding: string = dataUrl.indexOf("base64") > -1
      ? "base64"
      : "8bit";
    return {
      encoded,
      encoding,
    }
  }

}

export abstract class BlobStore extends BaseStore<string, MediaBlob> {
  lc_namespace = ["langchain", "google-common"];  // FIXME - What should this be? And why?

  async _realKey(key: string | MediaBlob): Promise<string> {
    return typeof key === 'string'
      ? key
      : await key.toUri();
  }

  async store(blob: MediaBlob): Promise<MediaBlob> {
    const key = await blob.toUri();
    await this.mset([[key, blob]]);
    return blob;
  }

  async fetch(key: string | MediaBlob): Promise<MediaBlob | undefined> {
    const realKey = await this._realKey(key);
    const ret = await this.mget([realKey])
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

