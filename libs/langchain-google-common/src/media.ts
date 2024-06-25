import {
  AsyncCaller,
  AsyncCallerCallOptions,
  AsyncCallerParams,
} from "@langchain/core/utils/async_caller";
import {
  MediaBlob,
  BlobStore,
  BlobStoreOptions,
} from "./utils/media_core.js";
import {
  GoogleConnectionParams,
  GoogleRawResponse,
  GoogleResponse,
} from "./types.js";
import { GoogleHostConnection, GoogleRawConnection } from "./connection.js";
import {
  GoogleAbstractedClient,
  GoogleAbstractedClientOpsMethod,
} from "./auth.js";

export interface GoogleUploadConnectionParams<AuthOptions>
  extends GoogleConnectionParams<AuthOptions> {}

export abstract class GoogleUploadConnection<
  CallOptions extends AsyncCallerCallOptions,
  ResponseType extends GoogleResponse,
  AuthOptions
> extends GoogleHostConnection<CallOptions, ResponseType, AuthOptions> {
  constructor(
    fields: GoogleConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient
  ) {
    super(fields, caller, client);
  }

  async _body(
    separator: string,
    data: MediaBlob,
    metadata: Record<string, unknown>
  ): Promise<string> {
    const contentType = data.mimetype;
    const { encoded, encoding } = await data.encode();
    const body = [
      `--${separator}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      "",
      `--${separator}`,
      `Content-Type: ${contentType}`,
      `Content-Transfer-Encoding: ${encoding}`,
      "",
      encoded,
      `--${separator}--`,
    ];
    return body.join("\n");
  }

  async request(
    data: MediaBlob,
    metadata: Record<string, unknown>,
    options: CallOptions
  ): Promise<ResponseType> {
    const separator = `separator-${Date.now()}`;
    const body = await this._body(separator, data, metadata);
    const requestHeaders = {
      "Content-Type": `multipart/related; boundary=${separator}`,
    };
    const response = this._request(body, options, requestHeaders);
    return response;
  }
}

export abstract class GoogleDownloadConnection<
  CallOptions extends AsyncCallerCallOptions,
  ResponseType extends GoogleResponse,
  AuthOptions
> extends GoogleHostConnection<CallOptions, ResponseType, AuthOptions> {
  async request(options: CallOptions): Promise<ResponseType> {
    return this._request(undefined, options);
  }
}

export abstract class GoogleDownloadRawConnection<
  CallOptions extends AsyncCallerCallOptions,
  AuthOptions
> extends GoogleRawConnection<CallOptions, AuthOptions> {
  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "GET";
  }

  async request(options: CallOptions): Promise<GoogleRawResponse> {
    return this._request(undefined, options);
  }
}

export interface BlobStoreGoogleParams<AuthOptions>
  extends GoogleConnectionParams<AuthOptions>,
    AsyncCallerParams,
    BlobStoreOptions
  {}

export abstract class BlobStoreGoogle<
  ResponseType extends GoogleResponse,
  AuthOptions
> extends BlobStore {
  caller: AsyncCaller;

  client: GoogleAbstractedClient;

  constructor(fields?: BlobStoreGoogleParams<AuthOptions>) {
    super(fields);
    this.caller = new AsyncCaller(fields ?? {});
    this.client = this.buildClient(fields);
  }

  abstract buildClient(
    fields?: BlobStoreGoogleParams<AuthOptions>
  ): GoogleAbstractedClient;

  abstract buildSetMetadata([key, blob]: [string, MediaBlob]): Record<
    string,
    unknown
  >;

  abstract buildSetConnection([key, blob]: [
    string,
    MediaBlob
  ]): GoogleUploadConnection<AsyncCallerCallOptions, ResponseType, AuthOptions>;

  async _set(keyValuePair: [string, MediaBlob]): Promise<void> {
    const [_key, blob] = keyValuePair;
    const setMetadata = this.buildSetMetadata(keyValuePair);
    const metadata = {
      contentType: blob.mimetype,
      ...setMetadata,
    };
    const options = {};
    const connection = this.buildSetConnection(keyValuePair);
    await connection.request(blob, metadata, options);
  }

  async mset(keyValuePairs: [string, MediaBlob][]): Promise<void> {
    const ret = keyValuePairs.map((keyValue) => this._set(keyValue));
    await Promise.all(ret);
  }

  abstract buildGetMetadataConnection(
    key: string
  ): GoogleDownloadConnection<
    AsyncCallerCallOptions,
    ResponseType,
    AuthOptions
  >;

  async _getMetadata(key: string): Promise<Record<string, unknown>> {
    const connection = this.buildGetMetadataConnection(key);
    const options = {};
    const response = await connection.request(options);
    return response.data;
  }

  abstract buildGetDataConnection(
    key: string
  ): GoogleDownloadRawConnection<AsyncCallerCallOptions, AuthOptions>;

  async _getData(key: string): Promise<Blob> {
    const connection = this.buildGetDataConnection(key);
    const options = {};
    const response = await connection.request(options);
    return response.data;
  }

  _getMimetypeFromMetadata(metadata: Record<string, unknown>): string {
    return metadata.contentType as string;
  }

  async _get(key: string): Promise<MediaBlob | undefined> {
    const metadata = await this._getMetadata(key);
    const data = await this._getData(key);
    if (data && metadata) {
      return new MediaBlob({
        path: key,
        data,
        metadata,
      });
    } else {
      return undefined;
    }
  }

  async mget(keys: string[]): Promise<(MediaBlob | undefined)[]> {
    const ret = keys.map((key) => this._get(key));
    return await Promise.all(ret);
  }

  abstract buildDeleteConnection(
    key: string
  ): GoogleDownloadConnection<
    AsyncCallerCallOptions,
    GoogleResponse,
    AuthOptions
  >;

  async _del(key: string): Promise<void> {
    const connection = this.buildDeleteConnection(key);
    const options = {};
    await connection.request(options);
  }

  async mdelete(keys: string[]): Promise<void> {
    const ret = keys.map((key) => this._del(key));
    await Promise.all(ret);
  }

  // eslint-disable-next-line require-yield
  async *yieldKeys(_prefix: string | undefined): AsyncGenerator<string> {
    // TODO: Implement. Most have an implementation that uses nextToken.
    throw new Error("yieldKeys is not implemented");
  }
}

/**
 * Based on https://cloud.google.com/storage/docs/json_api/v1/objects#resource
 */
export interface GoogleCloudStorageObject extends Record<string, unknown> {
  id?: string;
  name?: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
  // This is incomplete.
}

export interface GoogleCloudStorageResponse extends GoogleResponse {
  data: GoogleCloudStorageObject;
}

export type BucketAndPath = {
  bucket: string;
  path: string;
};

export class GoogleCloudStorageUri {
  static uriRegexp = /gs:\/\/([a-z0-9][a-z0-9._-]+[a-z0-9])\/(.*)/;

  bucket: string;

  path: string;

  constructor(uri: string) {
    const bucketAndPath = GoogleCloudStorageUri.uriToBucketAndPath(uri);
    this.bucket = bucketAndPath.bucket;
    this.path = bucketAndPath.path;
  }

  get uri() {
    return `gs://${this.bucket}/${this.path}`
  }

  get isValid() {
    return (
      typeof this.bucket !== "undefined" && typeof this.path !== "undefined"
    );
  }

  static uriToBucketAndPath(uri: string): BucketAndPath {
    const match = this.uriRegexp.exec(uri);
    if (!match) {
      throw new Error("Invalid gs:// URI");
    }
    return {
      bucket: match[1],
      path: match[2],
    };
  }

  static isValidUri(uri: string): boolean {
    return this.uriRegexp.test(uri);
  }
}

export interface GoogleCloudStorageConnectionParams {
  uri: string;
}

export interface GoogleCloudStorageUploadConnectionParams<AuthOptions>
  extends GoogleUploadConnectionParams<AuthOptions>,
    GoogleCloudStorageConnectionParams {}

export class GoogleCloudStorageUploadConnection<
  AuthOptions
> extends GoogleUploadConnection<
  AsyncCallerCallOptions,
  GoogleCloudStorageResponse,
  AuthOptions
> {
  uri: GoogleCloudStorageUri;

  constructor(
    fields: GoogleCloudStorageUploadConnectionParams<AuthOptions>,
    caller: AsyncCaller,
    client: GoogleAbstractedClient
  ) {
    super(fields, caller, client);
    this.uri = new GoogleCloudStorageUri(fields.uri);
  }

  async buildUrl(): Promise<string> {
    return `https://storage.googleapis.com/upload/storage/${this.apiVersion}/b/${this.uri.bucket}/o?uploadType=multipart`;
  }
}

export interface GoogleCloudStorageDownloadConnectionParams<AuthOptions>
  extends GoogleCloudStorageConnectionParams,
    GoogleConnectionParams<AuthOptions> {
  method: GoogleAbstractedClientOpsMethod;
  alt: "media" | undefined;
}

export class GoogleCloudStorageDownloadConnection<
  ResponseType extends GoogleResponse,
  AuthOptions
> extends GoogleDownloadConnection<
  AsyncCallerCallOptions,
  ResponseType,
  AuthOptions
> {
  uri: GoogleCloudStorageUri;

  method: GoogleAbstractedClientOpsMethod;

  alt: "media" | undefined;

  constructor(
    fields: GoogleCloudStorageDownloadConnectionParams<AuthOptions>,
    caller: AsyncCaller,
    client: GoogleAbstractedClient
  ) {
    super(fields, caller, client);
    this.uri = new GoogleCloudStorageUri(fields.uri);
    this.method = fields.method;
    this.alt = fields.alt;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return this.method;
  }

  async buildUrl(): Promise<string> {
    const path = encodeURIComponent(this.uri.path);
    const ret = `https://storage.googleapis.com/storage/${this.apiVersion}/b/${this.uri.bucket}/o/${path}`;
    return this.alt ? `${ret}?alt=${this.alt}` : ret;
  }
}

export interface GoogleCloudStorageRawConnectionParams<AuthOptions>
  extends GoogleCloudStorageConnectionParams,
    GoogleConnectionParams<AuthOptions> {}

export class GoogleCloudStorageRawConnection<
  AuthOptions
> extends GoogleDownloadRawConnection<AsyncCallerCallOptions, AuthOptions> {
  uri: GoogleCloudStorageUri;

  constructor(
    fields: GoogleCloudStorageRawConnectionParams<AuthOptions>,
    caller: AsyncCaller,
    client: GoogleAbstractedClient
  ) {
    super(fields, caller, client);
    this.uri = new GoogleCloudStorageUri(fields.uri);
  }

  async buildUrl(): Promise<string> {
    const path = encodeURIComponent(this.uri.path);
    const ret = `https://storage.googleapis.com/storage/${this.apiVersion}/b/${this.uri.bucket}/o/${path}?alt=media`;
    return ret;
  }
}

export interface BlobStoreGoogleCloudStorageBaseParams<AuthOptions>
  extends BlobStoreGoogleParams<AuthOptions> {

  uriPrefix: GoogleCloudStorageUri;

}

export abstract class BlobStoreGoogleCloudStorageBase<
  AuthOptions
> extends BlobStoreGoogle<GoogleCloudStorageResponse, AuthOptions> {

  params: BlobStoreGoogleCloudStorageBaseParams<AuthOptions>

  constructor(fields: BlobStoreGoogleCloudStorageBaseParams<AuthOptions>) {
    super(fields);
    this.params = fields;
    this.defaultStoreOptions = {
      ...this.defaultStoreOptions,
      pathPrefix: fields.uriPrefix.uri,
    }
  }

  buildSetConnection([key, _blob]: [string, MediaBlob]): GoogleUploadConnection<
    AsyncCallerCallOptions,
    GoogleCloudStorageResponse,
    AuthOptions
  > {
    const params: GoogleCloudStorageUploadConnectionParams<AuthOptions> = {
      ...this.params,
      uri: key,
    };
    return new GoogleCloudStorageUploadConnection<AuthOptions>(
      params,
      this.caller,
      this.client
    );
  }

  buildSetMetadata([key, blob]: [string, MediaBlob]): Record<string, unknown> {
    const uri = new GoogleCloudStorageUri(key);
    const ret: GoogleCloudStorageObject = {
      name: uri.path,
      metadata: blob.metadata,
      contentType: blob.mimetype,
    };
    return ret;
  }

  buildGetMetadataConnection(
    key: string
  ): GoogleDownloadConnection<
    AsyncCallerCallOptions,
    GoogleCloudStorageResponse,
    AuthOptions
  > {
    const params: GoogleCloudStorageDownloadConnectionParams<AuthOptions> = {
      uri: key,
      method: "GET",
      alt: undefined,
    };
    return new GoogleCloudStorageDownloadConnection<
      GoogleCloudStorageResponse,
      AuthOptions
    >(params, this.caller, this.client);
  }

  buildGetDataConnection(
    key: string
  ): GoogleDownloadRawConnection<AsyncCallerCallOptions, AuthOptions> {
    const params: GoogleCloudStorageRawConnectionParams<AuthOptions> = {
      uri: key,
    };
    return new GoogleCloudStorageRawConnection<AuthOptions>(
      params,
      this.caller,
      this.client
    );
  }

  buildDeleteConnection(
    key: string
  ): GoogleDownloadConnection<
    AsyncCallerCallOptions,
    GoogleResponse,
    AuthOptions
  > {
    const params: GoogleCloudStorageDownloadConnectionParams<AuthOptions> = {
      uri: key,
      method: "DELETE",
      alt: undefined,
    };
    return new GoogleCloudStorageDownloadConnection<
      GoogleResponse,
      AuthOptions
    >(params, this.caller, this.client);
  }
}

export type AIStudioFileState = "PROCESSING" | "ACTIVE" | "FAILED" | "STATE_UNSPECIFIED";

export type AIStudioFileVideoMetadata = {
  videoMetadata: {
    videoDuration: string,   // Duration in seconds, possibly with fractional, ending in "s"
  }
}

export type AIStudioFileMetadata = AIStudioFileVideoMetadata;

export interface AIStudioFileObject {
  name?: string,
  displayName?: string,
  mimeType?: string,
  sizeBytes?: string,      // int64 format
  createTime?: string,     // timestamp format
  updateTime?: string,     // timestamp format
  expirationTime?: string, // timestamp format
  sha256Hash?: string,     // base64 encoded
  uri?: string,
  state?: AIStudioFileState,
  error?: {
    code: number,
    message: string,
    details: Record<string,unknown>[],
  },
  metadata?: AIStudioFileMetadata,
}

export class AIStudioMediaBlob extends MediaBlob {

  _valueAsDate(value: string): Date {
    if (!value) {
      return new Date(0);
    }
    return new Date(value);
  }

  _metadataFieldAsDate(field: string): Date {
    return this._valueAsDate(this.metadata?.[field]);
  }

  get createDate(): Date {
    return this._metadataFieldAsDate("createTime");
  }

  get updateDate(): Date {
    return this._metadataFieldAsDate("updateTime");
  }

  get expirationDate(): Date {
    return this._metadataFieldAsDate("expirationTime");
  }

  get isExpired(): boolean {
    const now = (new Date()).toISOString();
    const exp = this.metadata?.expirationTime ?? now;
    return exp <= now;
  }
}

export interface AIStudioFileResponse extends GoogleResponse {
  data: AIStudioFileObject;
}

export interface AIStudioFileConnectionParams {}

export interface AIStudioFileUploadConnectionParams<AuthOptions>
  extends GoogleUploadConnectionParams<AuthOptions>,
    AIStudioFileConnectionParams {}

export class AIStudioFileUploadConnection<
  AuthOptions
> extends GoogleUploadConnection<
  AsyncCallerCallOptions,
  AIStudioFileResponse,
  AuthOptions
> {
  async buildUrl(): Promise<string> {
    return `https://generativelanguage.googleapis.com/upload/${this.apiVersion}/files`;
  }
}

export interface AIStudioFileDownloadConnectionParams<AuthOptions>
  extends AIStudioFileConnectionParams,
    GoogleConnectionParams<AuthOptions> {
  method: GoogleAbstractedClientOpsMethod;
  name: string;
}

export class AIStudioFileDownloadConnection<
  ResponseType extends GoogleResponse,
  AuthOptions
> extends GoogleDownloadConnection<AsyncCallerCallOptions, ResponseType, AuthOptions> {

  method: GoogleAbstractedClientOpsMethod;

  name: string;

  constructor(
    fields: AIStudioFileDownloadConnectionParams<AuthOptions>,
    caller: AsyncCaller,
    client: GoogleAbstractedClient
  ) {
    super(fields, caller, client);
    this.method = fields.method;
    this.name = fields.name;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return this.method
  }

  async buildUrl(): Promise<string> {
    return `https://generativelanguage.googleapis.com/${this.apiVersion}/files/${this.name}`;
  }
}

export interface BlobStoreAIStudioFileBaseParams<AuthOptions>
  extends BlobStoreGoogleParams<AuthOptions> {}

export abstract class BlobStoreAIStudioFileBase<
  AuthOptions
> extends BlobStoreGoogle<AIStudioFileResponse, AuthOptions> {

  params?: BlobStoreAIStudioFileBaseParams<AuthOptions>;

  constructor(fields?: BlobStoreAIStudioFileBaseParams<AuthOptions>) {
    super(fields);
    this.params = fields;
  }

  buildSetConnection([_key, _blob]: [string, MediaBlob]): GoogleUploadConnection<AsyncCallerCallOptions, AIStudioFileResponse, AuthOptions> {
    return new AIStudioFileUploadConnection(
      this.params,
      this.caller,
      this.client,
    )
  }

  buildSetMetadata([key, blob]: [string, MediaBlob]): Record<string, unknown> {
    return {
      displayName: key,
      mimeType: blob.mimetype,
    }
  }

  // TODO: Continue here
}