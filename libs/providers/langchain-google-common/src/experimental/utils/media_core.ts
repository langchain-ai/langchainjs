import { v1, v4 } from "uuid"; // FIXME - it is importing the wrong uuid, so v6 and v7 aren't implemented
import { BaseStore } from "@langchain/core/stores";
import { Serializable } from "@langchain/core/load/serializable";

export type MediaBlobData = {
  value: string; // In Base64 encoding
  type: string; // The mime type and possibly encoding
};

export interface MediaBlobParameters {
  data?: MediaBlobData;

  metadata?: Record<string, unknown>;

  path?: string;
}

function bytesToString(dataArray: Uint8Array): string {
  // Need to handle the array in smaller chunks to deal with stack size limits
  let ret = "";
  const chunkSize = 102400;
  for (let i = 0; i < dataArray.length; i += chunkSize) {
    const chunk = dataArray.subarray(i, i + chunkSize);
    ret += String.fromCharCode(...chunk);
  }

  return ret;
}

/**
 * Represents a chunk of data that can be identified by the path where the
 * data is (or will be) located, along with optional metadata about the data.
 */
export class MediaBlob extends Serializable implements MediaBlobParameters {
  lc_serializable = true;

  lc_namespace = [
    "langchain",
    "google_common",
    "experimental",
    "utils",
    "media_core",
  ];

  data: MediaBlobData = {
    value: "",
    type: "text/plain",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;

  path?: string;

  constructor(params: MediaBlobParameters) {
    super(params);

    this.data = params.data ?? this.data;
    this.metadata = params.metadata;
    this.path = params.path;
  }

  get size(): number {
    return this.asBytes.length;
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

  get asBytes(): Uint8Array {
    if (!this.data) {
      return Uint8Array.from([]);
    }
    const binString = atob(this.data?.value);
    const ret = new Uint8Array(binString.length);
    for (let co = 0; co < binString.length; co += 1) {
      ret[co] = binString.charCodeAt(co);
    }
    return ret;
  }

  async asString(): Promise<string> {
    return bytesToString(this.asBytes);
  }

  async asBase64(): Promise<string> {
    return this.data?.value ?? "";
  }

  async asDataUrl(): Promise<string> {
    return `data:${this.mimetype};base64,${await this.asBase64()}`;
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

  static fromDataUrl(url: string): MediaBlob {
    if (!url.startsWith("data:")) {
      throw new Error("Not a data: URL");
    }
    const colon = url.indexOf(":");
    const semicolon = url.indexOf(";");
    const mimeType = url.substring(colon + 1, semicolon);

    const comma = url.indexOf(",");
    const base64Data = url.substring(comma + 1);

    const data: MediaBlobData = {
      type: mimeType,
      value: base64Data,
    };

    return new MediaBlob({
      data,
      path: url,
    });
  }

  static async fromBlob(
    blob: Blob,
    other?: Omit<MediaBlobParameters, "data">
  ): Promise<MediaBlob> {
    const valueBuffer = await blob.arrayBuffer();
    const valueArray = new Uint8Array(valueBuffer);
    const valueStr = bytesToString(valueArray);
    const value = btoa(valueStr);

    return new MediaBlob({
      ...other,
      data: {
        value,
        type: blob.type,
      },
    });
  }
}

export type ActionIfInvalidAction =
  | "ignore"
  | "prefixPath"
  | "prefixUuid1"
  | "prefixUuid4"
  | "prefixUuid6"
  | "prefixUuid7"
  | "removePath";

export interface BlobStoreStoreOptions {
  /**
   * If the path is missing or invalid in the blob, how should we create
   * a new path?
   * Subclasses may define their own methods, but the following are supported
   * by default:
   * - Undefined or an emtpy string: Reject the blob
   * - "ignore": Attempt to store it anyway (but this may fail)
   * - "prefixPath": Use the default prefix for the BlobStore and get the
   *   unique portion from the URL. The original path is stored in the metadata
   * - "prefixUuid": Use the default prefix for the BlobStore and get the
   *   unique portion from a generated UUID. The original path is stored
   *   in the metadata
   */
  actionIfInvalid?: ActionIfInvalidAction;

  /**
   * The expected prefix for URIs that are stored.
   * This may be used to test if a MediaBlob is valid and used to create a new
   * path if "prefixPath" or "prefixUuid" is set for actionIfInvalid.
   */
  pathPrefix?: string;
}

export type ActionIfBlobMissingAction = "emptyBlob";

export interface BlobStoreFetchOptions {
  /**
   * If the blob is not found when fetching, what should we do?
   * Subclasses may define their own methods, but the following are supported
   * by default:
   * - Undefined or an empty string: return undefined
   * - "emptyBlob": return a new MediaBlob that has the path set, but nothing else.
   */
  actionIfBlobMissing?: ActionIfBlobMissingAction;
}

export interface BlobStoreOptions {
  defaultStoreOptions?: BlobStoreStoreOptions;

  defaultFetchOptions?: BlobStoreFetchOptions;
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

  defaultStoreOptions: BlobStoreStoreOptions;

  defaultFetchOptions: BlobStoreFetchOptions;

  constructor(opts?: BlobStoreOptions) {
    super(opts);
    this.defaultStoreOptions = opts?.defaultStoreOptions ?? {};
    this.defaultFetchOptions = opts?.defaultFetchOptions ?? {};
  }

  protected async _realKey(key: string | MediaBlob): Promise<string> {
    return typeof key === "string" ? key : await key.asUri();
  }

  /**
   * Is the path supported by this BlobStore?
   *
   * Although this is async, this is expected to be a relatively fast operation
   * (ie - you shouldn't make network calls).
   *
   * @param path The path to check
   * @param opts Any options (if needed) that may be used to determine if it is valid
   * @return If the path is supported
   */
  hasValidPath(
    path: string | undefined,
    opts?: BlobStoreStoreOptions
  ): Promise<boolean> {
    const prefix = opts?.pathPrefix ?? "";
    const isPrefixed = typeof path !== "undefined" && path.startsWith(prefix);
    return Promise.resolve(isPrefixed);
  }

  protected _blobPathSuffix(blob: MediaBlob): string {
    // Get the path currently set and make sure we treat it as a string
    const blobPath = `${blob.path}`;

    // Advance past the first set of /
    let pathStart = blobPath.indexOf("/") + 1;
    while (blobPath.charAt(pathStart) === "/") {
      pathStart += 1;
    }

    // We will use the rest as the path for a replacement
    return blobPath.substring(pathStart);
  }

  protected async _newBlob(
    oldBlob: MediaBlob,
    newPath?: string
  ): Promise<MediaBlob> {
    const oldPath = oldBlob.path;
    const metadata = oldBlob?.metadata ?? {};
    metadata.langchainOldPath = oldPath;
    const newBlob = new MediaBlob({
      ...oldBlob,
      metadata,
    });
    if (newPath) {
      newBlob.path = newPath;
    } else if (newBlob.path) {
      delete newBlob.path;
    }
    return newBlob;
  }

  protected async _validBlobPrefixPath(
    blob: MediaBlob,
    opts?: BlobStoreStoreOptions
  ): Promise<MediaBlob> {
    const prefix = opts?.pathPrefix ?? "";
    const suffix = this._blobPathSuffix(blob);
    const newPath = `${prefix}${suffix}`;
    return this._newBlob(blob, newPath);
  }

  protected _validBlobPrefixUuidFunction(
    name: ActionIfInvalidAction | string
  ): string {
    switch (name) {
      case "prefixUuid1":
        return v1();
      case "prefixUuid4":
        return v4();
      // case "prefixUuid6": return v6();
      // case "prefixUuid7": return v7();
      default:
        throw new Error(`Unknown uuid function: ${name}`);
    }
  }

  protected async _validBlobPrefixUuid(
    blob: MediaBlob,
    opts?: BlobStoreStoreOptions
  ): Promise<MediaBlob> {
    const prefix = opts?.pathPrefix ?? "";
    const suffix = this._validBlobPrefixUuidFunction(
      opts?.actionIfInvalid ?? "prefixUuid4"
    );
    const newPath = `${prefix}${suffix}`;
    return this._newBlob(blob, newPath);
  }

  protected async _validBlobRemovePath(
    blob: MediaBlob,
    _opts?: BlobStoreStoreOptions
  ): Promise<MediaBlob> {
    return this._newBlob(blob, undefined);
  }

  /**
   * Based on the blob and options, return a blob that has a valid path
   * that can be saved.
   * @param blob
   * @param opts
   */
  protected async _validStoreBlob(
    blob: MediaBlob,
    opts?: BlobStoreStoreOptions
  ): Promise<MediaBlob | undefined> {
    if (await this.hasValidPath(blob.path, opts)) {
      return blob;
    }
    switch (opts?.actionIfInvalid) {
      case "ignore":
        return blob;
      case "prefixPath":
        return this._validBlobPrefixPath(blob, opts);
      case "prefixUuid1":
      case "prefixUuid4":
      case "prefixUuid6":
      case "prefixUuid7":
        return this._validBlobPrefixUuid(blob, opts);
      case "removePath":
        return this._validBlobRemovePath(blob, opts);
      default:
        return undefined;
    }
  }

  async store(
    blob: MediaBlob,
    opts: BlobStoreStoreOptions = {}
  ): Promise<MediaBlob | undefined> {
    const allOpts: BlobStoreStoreOptions = {
      ...this.defaultStoreOptions,
      ...opts,
    };
    const validBlob = await this._validStoreBlob(blob, allOpts);
    if (typeof validBlob !== "undefined") {
      const validKey = await validBlob.asUri();
      await this.mset([[validKey, validBlob]]);
      const savedKey = await validBlob.asUri();
      return await this.fetch(savedKey);
    }
    return undefined;
  }

  protected async _missingFetchBlobEmpty(
    path: string,
    _opts?: BlobStoreFetchOptions
  ): Promise<MediaBlob> {
    return new MediaBlob({ path });
  }

  protected async _missingFetchBlob(
    path: string,
    opts?: BlobStoreFetchOptions
  ): Promise<MediaBlob | undefined> {
    switch (opts?.actionIfBlobMissing) {
      case "emptyBlob":
        return this._missingFetchBlobEmpty(path, opts);
      default:
        return undefined;
    }
  }

  async fetch(
    key: string | MediaBlob,
    opts: BlobStoreFetchOptions = {}
  ): Promise<MediaBlob | undefined> {
    const allOpts: BlobStoreFetchOptions = {
      ...this.defaultFetchOptions,
      ...opts,
    };
    const realKey = await this._realKey(key);
    const ret = await this.mget([realKey]);
    return ret?.[0] ?? (await this._missingFetchBlob(realKey, allOpts));
  }
}

export interface BackedBlobStoreOptions extends BlobStoreOptions {
  backingStore: BaseStore<string, MediaBlob>;
}

export class BackedBlobStore extends BlobStore {
  backingStore: BaseStore<string, MediaBlob>;

  constructor(opts: BackedBlobStoreOptions) {
    super(opts);
    this.backingStore = opts.backingStore;
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

export interface ReadThroughBlobStoreOptions extends BlobStoreOptions {
  baseStore: BlobStore;
  backingStore: BlobStore;
}

export class ReadThroughBlobStore extends BlobStore {
  baseStore: BlobStore;

  backingStore: BlobStore;

  constructor(opts: ReadThroughBlobStoreOptions) {
    super(opts);
    this.baseStore = opts.baseStore;
    this.backingStore = opts.backingStore;
  }

  async store(
    blob: MediaBlob,
    opts: BlobStoreStoreOptions = {}
  ): Promise<MediaBlob | undefined> {
    const originalUri = await blob.asUri();
    const newBlob = await this.backingStore.store(blob, opts);
    if (newBlob) {
      await this.baseStore.mset([[originalUri, newBlob]]);
    }
    return newBlob;
  }

  mdelete(keys: string[]): Promise<void> {
    return this.baseStore.mdelete(keys);
  }

  mget(keys: string[]): Promise<(MediaBlob | undefined)[]> {
    return this.baseStore.mget(keys);
  }

  mset(_keyValuePairs: [string, MediaBlob][]): Promise<void> {
    throw new Error("Do not call ReadThroughBlobStore.mset directly");
  }

  yieldKeys(prefix: string | undefined): AsyncGenerator<string> {
    return this.baseStore.yieldKeys(prefix);
  }
}

export class SimpleWebBlobStore extends BlobStore {
  _notImplementedException() {
    throw new Error("Not implemented for SimpleWebBlobStore");
  }

  async hasValidPath(
    path: string | undefined,
    _opts?: BlobStoreStoreOptions
  ): Promise<boolean> {
    return (
      (await super.hasValidPath(path, { pathPrefix: "https://" })) ||
      (await super.hasValidPath(path, { pathPrefix: "http://" }))
    );
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
      const resMediaBlob = await MediaBlob.fromBlob(await res.blob());
      ret.data = resMediaBlob.data;
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

/**
 * A blob "store" that works with data: URLs that will turn the URL into
 * a blob.
 */
export class DataBlobStore extends BlobStore {
  _notImplementedException() {
    throw new Error("Not implemented for DataBlobStore");
  }

  hasValidPath(path: string, _opts?: BlobStoreStoreOptions): Promise<boolean> {
    return super.hasValidPath(path, { pathPrefix: "data:" });
  }

  _fetch(url: string): MediaBlob {
    return MediaBlob.fromDataUrl(url);
  }

  async mget(keys: string[]): Promise<(MediaBlob | undefined)[]> {
    const blobMap = keys.map(this._fetch);
    return blobMap;
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
   * A store that, given a common URI, returns the corresponding MediaBlob.
   * The returned MediaBlob may have a different URI.
   * In many cases, this will be a ReadThroughStore or something similar
   * that has a cached version of the MediaBlob, but also a way to get
   * a new (or refreshed) version.
   */
  store: BlobStore;

  /**
   * BlobStores that can resolve a URL into the MediaBlob to save
   * in the canonical store. This list is evaluated in order.
   * If not provided, a default list (which involves a DataBlobStore
   * and a SimpleWebBlobStore) will be used.
   */
  resolvers?: BlobStore[];
}

/**
 * Responsible for converting a URI (typically a web URL) into a MediaBlob.
 * Allows for aliasing / caching of the requested URI and what it resolves to.
 * This MediaBlob is expected to be usable to provide to an LLM, either
 * through the Base64 of the media or through a canonical URI that the LLM
 * supports.
 */
export class MediaManager {
  store: BlobStore;

  resolvers: BlobStore[] | undefined;

  constructor(config: MediaManagerConfiguration) {
    this.store = config.store;
    this.resolvers = config.resolvers;
  }

  defaultResolvers(): BlobStore[] {
    return [new DataBlobStore({}), new SimpleWebBlobStore({})];
  }

  async _isInvalid(blob: MediaBlob | undefined): Promise<boolean> {
    return typeof blob === "undefined";
  }

  /**
   * Given the public URI, load what is at this URI and save it
   * in the store.
   * @param uri The URI to resolve using the resolver
   * @return A canonical MediaBlob for this URI
   */
  async _resolveAndSave(uri: string): Promise<MediaBlob | undefined> {
    let resolvedBlob: MediaBlob | undefined;

    const resolvers = this.resolvers || this.defaultResolvers();
    for (let co = 0; co < resolvers.length; co += 1) {
      const resolver = resolvers[co];
      if (await resolver.hasValidPath(uri)) {
        resolvedBlob = await resolver.fetch(uri);
      }
    }

    if (resolvedBlob) {
      return await this.store.store(resolvedBlob);
    } else {
      return new MediaBlob({});
    }
  }

  async getMediaBlob(uri: string): Promise<MediaBlob | undefined> {
    const aliasBlob = await this.store.fetch(uri);
    const ret = (await this._isInvalid(aliasBlob))
      ? await this._resolveAndSave(uri)
      : (aliasBlob as MediaBlob);
    return ret;
  }
}
