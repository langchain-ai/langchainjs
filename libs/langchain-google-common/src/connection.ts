/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import {
  AsyncCaller,
  AsyncCallerCallOptions,
} from "@langchain/core/utils/async_caller";
import { getRuntimeEnvironment } from "@langchain/core/utils/env";
import { BaseRunManager } from "@langchain/core/callbacks/manager";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type {
  GoogleAIBaseLLMInput,
  GoogleConnectionParams,
  GooglePlatformType,
  GoogleResponse,
  GoogleLLMResponse,
  GoogleAIModelRequestParams,
  GoogleRawResponse,
  GoogleAIAPI,
  VertexModelFamily,
  GoogleAIAPIConfig,
  AnthropicAPIConfig,
  GeminiAPIConfig,
} from "./types.js";
import {
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
  GoogleAbstractedClientOpsMethod,
} from "./auth.js";
import {
  getGeminiAPI,
  modelToFamily,
  modelToPublisher,
} from "./utils/index.js";
import { getAnthropicAPI } from "./utils/anthropic.js";

export abstract class GoogleConnection<
  CallOptions extends AsyncCallerCallOptions,
  ResponseType extends GoogleResponse
> {
  caller: AsyncCaller;

  client: GoogleAbstractedClient;

  streaming: boolean;

  constructor(
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    this.caller = caller;
    this.client = client;
    this.streaming = streaming ?? false;
  }

  abstract buildUrl(): Promise<string>;

  abstract buildMethod(): GoogleAbstractedClientOpsMethod;

  async _clientInfoHeaders(): Promise<Record<string, string>> {
    const { userAgent, clientLibraryVersion } = await this._getClientInfo();
    return {
      "User-Agent": userAgent,
      "Client-Info": clientLibraryVersion,
    };
  }

  async _getClientInfo(): Promise<{
    userAgent: string;
    clientLibraryVersion: string;
  }> {
    const env = await getRuntimeEnvironment();
    const langchain = env?.library ?? "langchain-js";
    // TODO: Add an API for getting the current LangChain version
    const langchainVersion = "0";
    const moduleName = await this._moduleName();
    let clientLibraryVersion = `${langchain}/${langchainVersion}`;
    if (moduleName && moduleName.length) {
      clientLibraryVersion = `${clientLibraryVersion}-${moduleName}`;
    }
    return {
      userAgent: clientLibraryVersion,
      clientLibraryVersion: `${langchainVersion}-${moduleName}`,
    };
  }

  async _moduleName(): Promise<string> {
    return this.constructor.name;
  }

  async additionalHeaders(): Promise<Record<string, string>> {
    return {};
  }

  async _buildOpts(
    data: unknown | undefined,
    _options: CallOptions,
    requestHeaders: Record<string, string> = {}
  ): Promise<GoogleAbstractedClientOps> {
    const url = await this.buildUrl();
    const method = this.buildMethod();
    const infoHeaders = (await this._clientInfoHeaders()) ?? {};
    const additionalHeaders = (await this.additionalHeaders()) ?? {};
    const headers = {
      ...infoHeaders,
      ...additionalHeaders,
      ...requestHeaders,
    };

    const opts: GoogleAbstractedClientOps = {
      url,
      method,
      headers,
    };
    if (data && method === "POST") {
      opts.data = data;
    }
    if (this.streaming) {
      opts.responseType = "stream";
    } else {
      opts.responseType = "json";
    }
    return opts;
  }

  async _request(
    data: unknown | undefined,
    options: CallOptions,
    requestHeaders: Record<string, string> = {}
  ): Promise<ResponseType> {
    const opts = await this._buildOpts(data, options, requestHeaders);
    const callResponse = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => this.client.request(opts)
    );
    const response: unknown = callResponse; // Done for typecast safety, I guess
    return <ResponseType>response;
  }
}

export abstract class GoogleHostConnection<
    CallOptions extends AsyncCallerCallOptions,
    ResponseType extends GoogleResponse,
    AuthOptions
  >
  extends GoogleConnection<CallOptions, ResponseType>
  implements GoogleConnectionParams<AuthOptions>
{
  // This does not default to a value intentionally.
  // Use the "platform" getter if you need this.
  platformType: GooglePlatformType | undefined;

  _endpoint: string | undefined;

  _location: string | undefined;

  _apiVersion: string | undefined;

  constructor(
    fields: GoogleConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    super(caller, client, streaming);
    this.caller = caller;

    this.platformType = this.fieldPlatformType(fields);
    this._endpoint = fields?.endpoint;
    this._location = fields?.location;
    this._apiVersion = fields?.apiVersion;
    this.client = client;
  }

  fieldPlatformType(
    fields: GoogleConnectionParams<any> | undefined
  ): GooglePlatformType | undefined {
    if (typeof fields === "undefined") {
      return undefined;
    }
    if (typeof fields.platformType !== "undefined") {
      return fields.platformType;
    }
    if (fields.vertexai === true) {
      return "gcp";
    }
    return undefined;
  }

  get platform(): GooglePlatformType {
    return this.platformType ?? this.computedPlatformType;
  }

  get computedPlatformType(): GooglePlatformType {
    return "gcp";
  }

  get computedApiVersion(): string {
    return "v1";
  }

  get apiVersion(): string {
    return this._apiVersion ?? this.computedApiVersion;
  }

  get location(): string {
    return this._location ?? this.computedLocation;
  }

  get computedLocation(): string {
    return "us-central1";
  }

  get endpoint(): string {
    return this._endpoint ?? this.computedEndpoint;
  }

  get computedEndpoint(): string {
    if (this.location === "global") {
      return "aiplatform.googleapis.com";
    } else {
      return `${this.location}-aiplatform.googleapis.com`;
    }
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "POST";
  }
}

export abstract class GoogleRawConnection<
  CallOptions extends AsyncCallerCallOptions,
  AuthOptions
> extends GoogleHostConnection<CallOptions, GoogleRawResponse, AuthOptions> {
  async _buildOpts(
    data: unknown | undefined,
    _options: CallOptions,
    requestHeaders: Record<string, string> = {}
  ): Promise<GoogleAbstractedClientOps> {
    const opts = await super._buildOpts(data, _options, requestHeaders);
    opts.responseType = "blob";
    return opts;
  }
}

export abstract class GoogleAIConnection<
    CallOptions extends AsyncCallerCallOptions,
    InputType,
    AuthOptions,
    ResponseType extends GoogleResponse
  >
  extends GoogleHostConnection<CallOptions, ResponseType, AuthOptions>
  implements GoogleAIBaseLLMInput<AuthOptions>
{
  model: string;

  modelName: string;

  client: GoogleAbstractedClient;

  _apiName?: string;

  apiConfig?: GoogleAIAPIConfig;

  constructor(
    fields: GoogleAIBaseLLMInput<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    super(fields, caller, client, streaming);
    this.client = client;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;

    this._apiName = fields?.apiName;
    this.apiConfig = {
      safetyHandler: fields?.safetyHandler, // For backwards compatibility
      ...fields?.apiConfig,
    };
  }

  get modelFamily(): VertexModelFamily {
    return modelToFamily(this.model);
  }

  get modelPublisher(): string {
    return modelToPublisher(this.model);
  }

  get computedAPIName(): string {
    // At least at the moment, model publishers and APIs map the same
    return this.modelPublisher;
  }

  get apiName(): string {
    return this._apiName ?? this.computedAPIName;
  }

  get api(): GoogleAIAPI {
    switch (this.apiName) {
      case "google":
      case "gemma": // TODO: Is this true?
        return getGeminiAPI(this.apiConfig as GeminiAPIConfig);
      case "anthropic":
        return getAnthropicAPI(this.apiConfig as AnthropicAPIConfig);
      default:
        throw new Error(`Unknown API: ${this.apiName}`);
    }
  }

  get isApiKey(): boolean {
    return this.client.clientType === "apiKey";
  }

  fieldPlatformType(
    fields: GoogleConnectionParams<any> | undefined
  ): GooglePlatformType | undefined {
    const ret = super.fieldPlatformType(fields);
    if (typeof ret !== "undefined") {
      return ret;
    }
    if (fields?.vertexai === false) {
      return "gai";
    }
    return undefined;
  }

  get computedPlatformType(): GooglePlatformType {
    // This is not a completely correct assumption, since GCP can
    // have an API Key. But if so, then people need to set the platform
    // type explicitly.
    if (this.isApiKey) {
      return "gai";
    } else {
      return "gcp";
    }
  }

  get computedApiVersion(): string {
    switch (this.platform) {
      case "gai":
        return "v1beta";
      default:
        return "v1";
    }
  }

  get computedLocation(): string {
    switch (this.apiName) {
      case "google":
        return super.computedLocation;
      case "anthropic":
        return "us-east5";
      default:
        throw new Error(
          `Unknown apiName: ${this.apiName}. Can't get location.`
        );
    }
  }

  abstract buildUrlMethod(): Promise<string>;

  async buildUrlGenerativeLanguage(): Promise<string> {
    const method = await this.buildUrlMethod();
    const url = `https://generativelanguage.googleapis.com/${this.apiVersion}/models/${this.model}:${method}`;
    return url;
  }

  async buildUrlVertexExpress(): Promise<string> {
    const method = await this.buildUrlMethod();
    const publisher = this.modelPublisher;
    const url = `https://aiplatform.googleapis.com/${this.apiVersion}/publishers/${publisher}/models/${this.model}:${method}`;
    return url;
  }

  async buildUrlVertexLocation(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const method = await this.buildUrlMethod();
    const publisher = this.modelPublisher;
    const url = `https://${this.endpoint}/${this.apiVersion}/projects/${projectId}/locations/${this.location}/publishers/${publisher}/models/${this.model}:${method}`;
    return url;
  }

  async buildUrlVertex(): Promise<string> {
    if (this.isApiKey) {
      return this.buildUrlVertexExpress();
    } else {
      return this.buildUrlVertexLocation();
    }
  }

  async buildUrl(): Promise<string> {
    switch (this.platform) {
      case "gai":
        return this.buildUrlGenerativeLanguage();
      default:
        return this.buildUrlVertex();
    }
  }

  abstract formatData(
    input: InputType,
    parameters: GoogleAIModelRequestParams
  ): Promise<unknown>;

  async request(
    input: InputType,
    parameters: GoogleAIModelRequestParams,

    options: CallOptions,
    runManager?: BaseRunManager
  ): Promise<ResponseType> {
    const moduleName = this.constructor.name;
    const streamingParameters: GoogleAIModelRequestParams = {
      ...parameters,
      streaming: this.streaming,
    };
    const data = await this.formatData(input, streamingParameters);

    await runManager?.handleCustomEvent(`google-request-${moduleName}`, {
      data,
      parameters: streamingParameters,
      options,
      connection: {
        ...this,
        url: await this.buildUrl(),
        urlMethod: await this.buildUrlMethod(),
        modelFamily: this.modelFamily,
        modelPublisher: this.modelPublisher,
        computedPlatformType: this.computedPlatformType,
      },
    });

    const response = await this._request(data, options);

    await runManager?.handleCustomEvent(`google-response-${moduleName}`, {
      response,
    });

    return response;
  }
}

export abstract class AbstractGoogleLLMConnection<
  MessageType,
  AuthOptions
> extends GoogleAIConnection<
  BaseLanguageModelCallOptions,
  MessageType,
  AuthOptions,
  GoogleLLMResponse
> {
  async buildUrlMethodGemini(): Promise<string> {
    return this.streaming ? "streamGenerateContent" : "generateContent";
  }

  async buildUrlMethodClaude(): Promise<string> {
    return this.streaming ? "streamRawPredict" : "rawPredict";
  }

  async buildUrlMethod(): Promise<string> {
    switch (this.modelFamily) {
      case "gemini":
      case "gemma": // TODO: Is this true?
        return this.buildUrlMethodGemini();
      case "claude":
        return this.buildUrlMethodClaude();
      default:
        throw new Error(`Unknown model family: ${this.modelFamily}`);
    }
  }

  async formatData(
    input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): Promise<unknown> {
    // Filter out labels for non-Vertex AI platforms (labels are only supported on Vertex AI)
    let filteredParameters = parameters;
    if (parameters.labels && this.platform !== "gcp") {
      const { labels, ...paramsWithoutLabels } = parameters;
      filteredParameters = paramsWithoutLabels;
    }

    return this.api.formatData(input, filteredParameters);
  }
}

export interface GoogleCustomEventInfo {
  subEvent: string;
  module: string;
}

export abstract class GoogleRequestCallbackHandler extends BaseCallbackHandler {
  customEventInfo(eventName: string): GoogleCustomEventInfo {
    const names = eventName.split("-");
    return {
      subEvent: names[1],
      module: names[2],
    };
  }

  abstract handleCustomRequestEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any;

  abstract handleCustomResponseEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any;

  abstract handleCustomChunkEvent(
    eventName: string,
    eventInfo: GoogleCustomEventInfo,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any;

  handleCustomEvent(
    eventName: string,
    data: any,
    runId: string,
    tags?: string[],
    metadata?: Record<string, any>
  ): any {
    if (!eventName) {
      return undefined;
    }
    const eventInfo = this.customEventInfo(eventName);
    switch (eventInfo.subEvent) {
      case "request":
        return this.handleCustomRequestEvent(
          eventName,
          eventInfo,
          data,
          runId,
          tags,
          metadata
        );
      case "response":
        return this.handleCustomResponseEvent(
          eventName,
          eventInfo,
          data,
          runId,
          tags,
          metadata
        );
      case "chunk":
        return this.handleCustomChunkEvent(
          eventName,
          eventInfo,
          data,
          runId,
          tags,
          metadata
        );
      default:
        console.error(
          `Unexpected eventInfo for ${eventName} ${JSON.stringify(
            eventInfo,
            null,
            1
          )}`
        );
    }
  }
}

export class GoogleRequestLogger extends GoogleRequestCallbackHandler {
  name: string = "GoogleRequestLogger";

  log(eventName: string, data: any, tags?: string[]): undefined {
    const tagStr = tags ? `[${tags}]` : "[]";
    console.log(`${eventName} ${tagStr} ${JSON.stringify(data, null, 1)}`);
  }

  handleCustomRequestEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.log(eventName, data, tags);
  }

  handleCustomResponseEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.log(eventName, data, tags);
  }

  handleCustomChunkEvent(
    eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.log(eventName, data, tags);
  }
}

export class GoogleRequestRecorder extends GoogleRequestCallbackHandler {
  name = "GoogleRequestRecorder";

  request: any = {};

  response: any = {};

  chunk: any[] = [];

  handleCustomRequestEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.request = data;
  }

  handleCustomResponseEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.response = data;
  }

  handleCustomChunkEvent(
    _eventName: string,
    _eventInfo: GoogleCustomEventInfo,
    data: any,
    _runId: string,
    _tags?: string[],
    _metadata?: Record<string, any>
  ): any {
    this.chunk.push(data);
  }
}
