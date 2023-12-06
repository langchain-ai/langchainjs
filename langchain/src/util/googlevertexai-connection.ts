import { BaseLanguageModelCallOptions } from "../base_language/index.js";
import { AsyncCaller, AsyncCallerCallOptions } from "./async_caller.js";
import type {
  GoogleVertexAIBaseLLMInput,
  GoogleVertexAIBasePrediction,
  GoogleVertexAIConnectionParams,
  GoogleVertexAILLMPredictions,
  GoogleVertexAIModelParams,
  GoogleResponse,
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
  GoogleAbstractedClientOpsMethod,
} from "../types/googlevertexai-types.js";
import { GenerationChunk } from "../schema/index.js";

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

  async _request(
    data: unknown | undefined,
    options: CallOptions
  ): Promise<ResponseType> {
    const url = await this.buildUrl();
    const method = this.buildMethod();

    const opts: GoogleAbstractedClientOps = {
      url,
      method,
    };
    if (data && method === "POST") {
      opts.data = data;
    }
    if (this.streaming) {
      opts.responseType = "stream";
    } else {
      opts.responseType = "json";
    }

    const callResponse = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => this.client.request(opts)
    );
    const response: unknown = callResponse; // Done for typecast safety, I guess
    return <ResponseType>response;
  }
}

export abstract class GoogleVertexAIConnection<
    CallOptions extends AsyncCallerCallOptions,
    ResponseType extends GoogleResponse,
    AuthOptions
  >
  extends GoogleConnection<CallOptions, ResponseType>
  implements GoogleVertexAIConnectionParams<AuthOptions>
{
  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  apiVersion = "v1";

  constructor(
    fields: GoogleVertexAIConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    super(caller, client, streaming);
    this.caller = caller;

    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.apiVersion = fields?.apiVersion ?? this.apiVersion;
    this.client = client;
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "POST";
  }
}

export function complexValue(value: unknown): unknown {
  if (value === null || typeof value === "undefined") {
    // I dunno what to put here. An error, probably
    return undefined;
  } else if (typeof value === "object") {
    if (Array.isArray(value)) {
      return {
        list_val: value.map((avalue) => complexValue(avalue)),
      };
    } else {
      const ret: Record<string, unknown> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v: Record<string, any> = value;
      Object.keys(v).forEach((key) => {
        ret[key] = complexValue(v[key]);
      });
      return { struct_val: ret };
    }
  } else if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return { int_val: value };
    } else {
      return { float_val: value };
    }
  } else {
    return {
      string_val: [value],
    };
  }
}

export function simpleValue(val: unknown): unknown {
  if (val && typeof val === "object" && !Array.isArray(val)) {
    // eslint-disable-next-line no-prototype-builtins
    if (val.hasOwnProperty("stringVal")) {
      return (val as { stringVal: string[] }).stringVal[0];

      // eslint-disable-next-line no-prototype-builtins
    } else if (val.hasOwnProperty("boolVal")) {
      return (val as { boolVal: boolean[] }).boolVal[0];

      // eslint-disable-next-line no-prototype-builtins
    } else if (val.hasOwnProperty("listVal")) {
      const { listVal } = val as { listVal: unknown[] };
      return listVal.map((aval) => simpleValue(aval));

      // eslint-disable-next-line no-prototype-builtins
    } else if (val.hasOwnProperty("structVal")) {
      const ret: Record<string, unknown> = {};
      const struct = (val as { structVal: Record<string, unknown> }).structVal;
      Object.keys(struct).forEach((key) => {
        ret[key] = simpleValue(struct[key]);
      });
      return ret;
    } else {
      const ret: Record<string, unknown> = {};
      const struct = val as Record<string, unknown>;
      Object.keys(struct).forEach((key) => {
        ret[key] = simpleValue(struct[key]);
      });
      return ret;
    }
  } else if (Array.isArray(val)) {
    return val.map((aval) => simpleValue(aval));
  } else {
    return val;
  }
}

export class GoogleVertexAILLMConnection<
    CallOptions extends BaseLanguageModelCallOptions,
    InstanceType,
    PredictionType extends GoogleVertexAIBasePrediction,
    AuthOptions
  >
  extends GoogleVertexAIConnection<
    CallOptions,
    GoogleVertexAILLMResponse<PredictionType>,
    AuthOptions
  >
  implements GoogleVertexAIBaseLLMInput<AuthOptions>
{
  model: string;

  client: GoogleAbstractedClient;

  constructor(
    fields: GoogleVertexAIBaseLLMInput<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    super(fields, caller, client, streaming);
    this.client = client;
    this.model = fields?.model ?? this.model;
  }

  async buildUrl(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const method = this.streaming ? "serverStreamingPredict" : "predict";
    const url = `https://${this.endpoint}/v1/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:${method}`;
    return url;
  }

  formatStreamingData(
    inputs: InstanceType[],
    parameters: GoogleVertexAIModelParams
  ): unknown {
    return {
      inputs: [inputs.map((i) => complexValue(i))],
      parameters: complexValue(parameters),
    };
  }

  formatStandardData(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams
  ): unknown {
    return {
      instances,
      parameters,
    };
  }

  formatData(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams
  ): unknown {
    return this.streaming
      ? this.formatStreamingData(instances, parameters)
      : this.formatStandardData(instances, parameters);
  }

  async request(
    instances: InstanceType[],
    parameters: GoogleVertexAIModelParams,
    options: CallOptions
  ): Promise<GoogleVertexAILLMResponse<PredictionType>> {
    const data = this.formatData(instances, parameters);
    const response = await this._request(data, options);
    return response;
  }
}

export interface GoogleVertexAILLMResponse<
  PredictionType extends GoogleVertexAIBasePrediction
> extends GoogleResponse {
  data: GoogleVertexAIStream | GoogleVertexAILLMPredictions<PredictionType>;
}

export class GoogleVertexAIStream {
  _buffer = "";

  _bufferOpen = true;

  _firstRun = true;

  /**
   * Add data to the buffer. This may cause chunks to be generated, if available.
   * @param data
   */
  appendBuffer(data: string): void {
    this._buffer += data;
    // Our first time, skip to the opening of the array
    if (this._firstRun) {
      this._skipTo("[");
      this._firstRun = false;
    }

    this._parseBuffer();
  }

  /**
   * Indicate there is no more data that will be added to the text buffer.
   * This should be called when all the data has been read and added to indicate
   * that we should process everything remaining in the buffer.
   */
  closeBuffer(): void {
    this._bufferOpen = false;
    this._parseBuffer();
  }

  /**
   * Skip characters in the buffer till we get to the start of an object.
   * Then attempt to read a full object.
   * If we do read a full object, turn it into a chunk and send it to the chunk handler.
   * Repeat this for as much as we can.
   */
  _parseBuffer(): void {
    let obj = null;
    do {
      this._skipTo("{");
      obj = this._getFullObject();
      if (obj !== null) {
        const chunk = this._simplifyObject(obj);
        this._handleChunk(chunk);
      }
    } while (obj !== null);

    if (!this._bufferOpen) {
      // No more data will be added, and we have parsed everything we could,
      // so everything else is garbage.
      this._handleChunk(null);
      this._buffer = "";
    }
  }

  /**
   * If the string is present, move the start of the buffer to the first occurrence
   * of that string. This is useful for skipping over elements or parts that we're not
   * really interested in parsing. (ie - the opening characters, comma separators, etc.)
   * @param start The string to start the buffer with
   */
  _skipTo(start: string): void {
    const index = this._buffer.indexOf(start);
    if (index > 0) {
      this._buffer = this._buffer.slice(index);
    }
  }

  /**
   * Given what is in the buffer, parse a single object out of it.
   * If a complete object isn't available, return null.
   * Assumes that we are at the start of an object to parse.
   */
  _getFullObject(): object | null {
    let ret: object | null = null;

    // Loop while we don't have something to return AND we have something in the buffer
    let index = 0;
    while (ret === null && this._buffer.length > index) {
      // Advance to the next close bracket after our current index
      index = this._buffer.indexOf("}", index + 1);

      // If we don't find one, exit with null
      if (index === -1) {
        return null;
      }

      // If we have one, try to turn it into an object to return
      try {
        const objStr = this._buffer.substring(0, index + 1);
        ret = JSON.parse(objStr);

        // We only get here if it parsed it ok
        // If we did turn it into an object, remove it from the buffer
        this._buffer = this._buffer.slice(index + 1);
      } catch (xx) {
        // It didn't parse it correctly, so we swallow the exception and continue
      }
    }

    return ret;
  }

  _simplifyObject(obj: unknown): object {
    return simpleValue(obj) as object;
  }

  // Set up a potential Promise that the handler can resolve.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _chunkResolution: (chunk: any) => void;

  // If there is no Promise (it is null), the handler must add it to the queue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _chunkPending: Promise<any> | null = null;

  // A queue that will collect chunks while there is no Promise
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _chunkQueue: any[] = [];

  /**
   * Register that we have another chunk available for consumption.
   * If we are waiting for a chunk, resolve the promise waiting for it immediately.
   * If not, then add it to the queue.
   * @param chunk
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _handleChunk(chunk: any): void {
    if (this._chunkPending) {
      this._chunkResolution(chunk);
      this._chunkPending = null;
    } else {
      this._chunkQueue.push(chunk);
    }
  }

  /**
   * Get the next chunk that is coming from the stream.
   * This chunk may be null, usually indicating the last chunk in the stream.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async nextChunk(): Promise<any> {
    if (this._chunkQueue.length > 0) {
      // If there is data in the queue, return the next queue chunk
      return this._chunkQueue.shift() as GenerationChunk;
    } else {
      // Otherwise, set up a promise that handleChunk will cause to be resolved
      this._chunkPending = new Promise((resolve) => {
        this._chunkResolution = resolve;
      });
      return this._chunkPending;
    }
  }

  /**
   * Is the stream done?
   * A stream is only done if all of the following are true:
   * - There is no more data to be added to the text buffer
   * - There is no more data in the text buffer
   * - There are no chunks that are waiting to be consumed
   */
  get streamDone(): boolean {
    return (
      !this._bufferOpen &&
      this._buffer.length === 0 &&
      this._chunkQueue.length === 0 &&
      this._chunkPending === null
    );
  }
}
