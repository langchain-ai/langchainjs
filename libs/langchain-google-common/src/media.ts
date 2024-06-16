import {AsyncCaller, AsyncCallerCallOptions, AsyncCallerParams} from "@langchain/core/utils/async_caller";
import { Blob, BlobStore } from "./utils/media_core.js";
import {GoogleConnectionParams, GoogleRawResponse, GoogleResponse} from "./types.js";
import { GoogleHostConnection } from "./connection.js";
import {GoogleAbstractedClient, GoogleAbstractedClientOpsMethod} from "./auth.js";

export interface GoogleUploadConnectionParams<AuthOptions> extends GoogleConnectionParams<AuthOptions> {
}

export abstract class GoogleUploadConnection <
    CallOptions extends AsyncCallerCallOptions,
    ResponseType extends GoogleResponse,
    AuthOptions
  >
  extends GoogleHostConnection<CallOptions, ResponseType, AuthOptions>
{

  constructor(
    fields: GoogleConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
  ) {
    super(fields, caller, client);
  }

  _body(
    separator: string,
    data: string | Uint8Array,
    contentType: string,
    metadata: Record<string,unknown>,
  ): string {
    let contentTransferEncoding = "8bit";
    let dataEncoded = data;
    if (Array.isArray(data)) {
      contentTransferEncoding = "base64";
      dataEncoded = btoa(String.fromCharCode(...data));
    }
    const body = [
      `--${separator}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      "",
      `--${separator}`,
      `Content-Type: ${contentType}`,
      `Content-Transfer-Encoding: ${contentTransferEncoding}`,
      "",
      dataEncoded,
      `--${separator}--`,
    ];
    return body.join("\n");
  }

  async request(
    data: string | Uint8Array,
    metadata: Record<string,unknown>,
    options: CallOptions,
  ): Promise<ResponseType> {
    const separator = `separator-${Date.now()}`;
    const contentType: string = metadata.contentType as string ?? "application/octet-stream";
    const body = this._body(separator, data, contentType, metadata);
    const requestHeaders = {
      "Content-Type": `multipart/related; boundary=${separator}`,
    }
    const response = this._request(body, options, requestHeaders);
    return response;
  }

}

export abstract class GoogleDownloadConnection<
    CallOptions extends AsyncCallerCallOptions,
    ResponseType extends GoogleResponse,
    AuthOptions
  >
  extends GoogleHostConnection<CallOptions, ResponseType, AuthOptions>
{
  async request(options: CallOptions): Promise<ResponseType> {
    return this._request(undefined, options);
  }
}

export interface BlobStoreGoogleParams<AuthOptions>
  extends GoogleConnectionParams<AuthOptions>, AsyncCallerParams
{}

export abstract class BlobStoreGoogle<
    ResponseType extends GoogleResponse,
    AuthOptions
  >
  extends BlobStore
{

  caller: AsyncCaller;

  client: GoogleAbstractedClient;

  constructor(fields: BlobStoreGoogleParams<AuthOptions>) {
    super(fields);
    this.caller = new AsyncCaller(fields ?? {});
    this.client = this.buildClient(fields);
  }

  abstract buildClient(fields?: BlobStoreGoogleParams<AuthOptions>): GoogleAbstractedClient;

  abstract buildSetMetadata([key, blob]: [string, Blob]): Record<string, unknown>;

  abstract buildSetConnection([key, blob]: [string, Blob]):
    GoogleUploadConnection<AsyncCallerCallOptions, ResponseType, AuthOptions>;

  async _set(keyValuePair: [string, Blob]): Promise<void> {
    const [_key, blob] = keyValuePair;
    const data = blob.data ?? "";
    console.log('this',this);
    console.log('this.buildSetMetadata', this.buildSetMetadata);
    const setMetadata = this.buildSetMetadata(keyValuePair);
    const metadata = {
      contentType: blob.mimetype,
      ...setMetadata,
    }
    const options = {};
    const connection = this.buildSetConnection(keyValuePair);
    await connection.request(data, metadata, options);
  }

  async mset(keyValuePairs: [string, Blob][]): Promise<void> {
    const ret = keyValuePairs.map(keyValue => this._set(keyValue));
    await Promise.all(ret);
  }

  abstract buildGetMetadataConnection(key: string):
    GoogleDownloadConnection<AsyncCallerCallOptions, ResponseType, AuthOptions>;

  async _getMetadata(key: string): Promise<Record<string,unknown>> {
    const connection = this.buildGetMetadataConnection(key);
    const options = {};
    const response = await connection.request(options);
    return response.data;
  }

  abstract buildGetDataConnection(key: string):
    GoogleDownloadConnection<AsyncCallerCallOptions, GoogleRawResponse, AuthOptions>;

  async _getData(key: string): Promise<Uint8Array> {
    const connection = this.buildGetDataConnection(key);
    const options = {};
    const response = await connection.request(options);
    return response.data;
  }

  _getMimetypeFromMetadata(metadata: Record<string, unknown>): string {
    return metadata.contentType as string;
  }

  async _get(key: string): Promise<Blob | undefined> {
    const metadata = await this._getMetadata(key);
    const data = await this._getData(key);
    if (data && metadata) {
      const mimetype = this._getMimetypeFromMetadata(metadata);
      return new Blob({
        path: key,
        data,
        metadata,
        mimetype,
      })
    } else {
      return undefined;
    }
  }

  async mget(keys: string[]): Promise<(Blob | undefined)[]> {
    const ret = keys.map(key => this._get(key));
    return await Promise.all(ret);
  }

  abstract buildDeleteConnection(key: string):
    GoogleDownloadConnection<AsyncCallerCallOptions, GoogleResponse, AuthOptions>;

  async _del(key: string): Promise<void>{
    const connection = this.buildDeleteConnection(key);
    const options = {};
    await connection.request(options);
  }

  async mdelete(keys: string[]): Promise<void> {
    const ret = keys.map(key => this._del(key));
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
export interface GoogleCloudStorageObject extends Record<string,unknown> {
  id?: string;
  name?: string;
  contentType?: string;
  metadata?: Record<string,unknown>;
  // This is incomplete.
}

export interface GoogleCloudStorageResponse extends GoogleResponse {
  data: GoogleCloudStorageObject;
}

export type BucketAndPath = {
  bucket: string;
  path: string;
}

export class GoogleCloudStorageUri {

  static uriRegexp = /gs:\/\/([a-z0-9][a-z0-9._-]+[a-z0-9])\/(.*)/;

  bucket: string;

  path: string;

  constructor(uri: string) {
    const bucketAndPath = GoogleCloudStorageUri.uriToBucketAndPath(uri);
    this.bucket = bucketAndPath.bucket;
    this.path = bucketAndPath.path;
  }

  get isValid() {
    return typeof this.bucket !== "undefined" && typeof this.path !== "undefined";
  }

  static uriToBucketAndPath(uri: string): BucketAndPath {
    const match = this.uriRegexp.exec(uri);
    if (!match) {
      throw new Error("Invalid gs:// URI");
    }
    return {
      bucket: match[1],
      path: match[2],
    }
  }

  static isValidUri(uri: string): boolean {
    return this.uriRegexp.test(uri);
  }

}

export interface GoogleCloudStorageConnectionParams {
  uri: string;
}

export interface GoogleCloudStorageUploadConnectionParams<AuthOptions>
  extends GoogleUploadConnectionParams<AuthOptions>, GoogleCloudStorageConnectionParams
{
}

export class GoogleCloudStorageUploadConnection<AuthOptions>
  extends GoogleUploadConnection<AsyncCallerCallOptions, GoogleCloudStorageResponse, AuthOptions>
{

  uri: GoogleCloudStorageUri;

  constructor(
    fields: GoogleCloudStorageUploadConnectionParams<AuthOptions>,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
  ) {
    super(fields, caller, client);
    this.uri = new GoogleCloudStorageUri(fields.uri);
  }

  async buildUrl(): Promise<string> {
    return `https://storage.googleapis.com/upload/storage/${this.apiVersion}/b/${this.uri.bucket}/o?uploadType=multipart`;
  }
}

export interface GoogleCloudStorageDownloadConnectionParams<AuthOptions>
  extends GoogleCloudStorageConnectionParams, GoogleConnectionParams<AuthOptions>
{
  method: GoogleAbstractedClientOpsMethod;
  alt: "media" | undefined;
}

export class GoogleCloudStorageDownloadConnection<ResponseType extends GoogleResponse, AuthOptions>
  extends GoogleDownloadConnection<AsyncCallerCallOptions, ResponseType, AuthOptions>
{

  uri: GoogleCloudStorageUri;

  method: GoogleAbstractedClientOpsMethod;

  alt: "media" | undefined;

  constructor(
    fields: GoogleCloudStorageDownloadConnectionParams<AuthOptions>,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
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
    const ret = `https://storage.googleapis.com/upload/storage/${this.apiVersion}/b/${this.uri.bucket}/o/${this.uri.path}`;
    return this.alt
      ? `${ret}?alt=${this.alt}`
      : ret;
  }

}

export interface BlobStoreGoogleCloudStorageBaseParams<AuthOptions>
  extends BlobStoreGoogleParams<AuthOptions>
{}

export abstract class BlobStoreGoogleCloudStorageBase<AuthOptions>
  extends BlobStoreGoogle<GoogleCloudStorageResponse, AuthOptions>
{

  constructor(fields: BlobStoreGoogleCloudStorageBaseParams<AuthOptions>) {
    super(fields);
  }

  buildSetConnection([key, _blob]: [string, Blob]): GoogleUploadConnection<AsyncCallerCallOptions, GoogleCloudStorageResponse, AuthOptions> {
    const params: GoogleCloudStorageUploadConnectionParams<AuthOptions> = {
      uri: key,
    }
    return new GoogleCloudStorageUploadConnection<AuthOptions>(
      params, this.caller, this.client
    );
  }

  buildSetMetadata([key, blob]: [string, Blob]): Record<string, unknown> {
    const uri = new GoogleCloudStorageUri(key);
    const ret: GoogleCloudStorageObject = {
      name: uri.path,
      metadata: blob.metadata,
      contentType: blob.mimetype,
    }
    return ret;
  }


  buildGetMetadataConnection(key: string): GoogleDownloadConnection<AsyncCallerCallOptions, GoogleCloudStorageResponse, AuthOptions> {
    const params: GoogleCloudStorageDownloadConnectionParams<AuthOptions> = {
      uri: key,
      method: "GET",
      alt: undefined,
    }
    return new GoogleCloudStorageDownloadConnection<GoogleCloudStorageResponse, AuthOptions>(
      params, this.caller, this.client
    )
  }


  buildGetDataConnection(key: string): GoogleDownloadConnection<AsyncCallerCallOptions, GoogleRawResponse, AuthOptions> {
    const params: GoogleCloudStorageDownloadConnectionParams<AuthOptions> = {
      uri: key,
      method: "GET",
      alt: "media",
    }
    return new GoogleCloudStorageDownloadConnection<GoogleRawResponse, AuthOptions>(
      params, this.caller, this.client
    )
  }


  buildDeleteConnection(key: string): GoogleDownloadConnection<AsyncCallerCallOptions, GoogleResponse, AuthOptions> {
    const params: GoogleCloudStorageDownloadConnectionParams<AuthOptions> = {
      uri: key,
      method: "DELETE",
      alt: undefined,
    }
    return new GoogleCloudStorageDownloadConnection<GoogleResponse, AuthOptions>(
      params, this.caller, this.client
    )
  }
}