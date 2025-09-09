import { Readable } from "stream";
import {
  AbstractStream,
  ensureAuthOptionScopes,
  GoogleAbstractedClientOps,
  GoogleAbstractedFetchClient,
  GoogleConnectionParams,
  JsonStream,
  SseJsonStream,
  SseStream,
} from "@langchain/google-common";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";

export class NodeAbstractStream implements AbstractStream {
  private baseStream: AbstractStream;

  constructor(baseStream: AbstractStream, data: Readable) {
    this.baseStream = baseStream;
    const decoder = new TextDecoder("utf-8");
    data.on("data", (data) => {
      const text = decoder.decode(data, { stream: true });
      this.appendBuffer(text);
    });
    data.on("end", () => {
      const rest = decoder.decode();
      this.appendBuffer(rest);
      this.closeBuffer();
    });
  }

  appendBuffer(data: string): void {
    return this.baseStream.appendBuffer(data);
  }

  closeBuffer(): void {
    return this.baseStream.closeBuffer();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nextChunk(): Promise<any> {
    return this.baseStream.nextChunk();
  }

  get streamDone(): boolean {
    return this.baseStream.streamDone;
  }
}

export class NodeJsonStream extends NodeAbstractStream {
  constructor(data: Readable) {
    super(new JsonStream(), data);
  }
}

export class NodeSseStream extends NodeAbstractStream {
  constructor(data: Readable) {
    super(new SseStream(), data);
  }
}

export class NodeSseJsonStream extends NodeAbstractStream {
  constructor(data: Readable) {
    super(new SseJsonStream(), data);
  }
}

export class GAuthClient extends GoogleAbstractedFetchClient {
  gauth: GoogleAuth;

  constructor(fields?: GoogleConnectionParams<GoogleAuthOptions>) {
    super();
    const options = ensureAuthOptionScopes<GoogleAuthOptions>(
      fields?.authOptions,
      "scopes",
      fields?.platformType
    );
    this.gauth = new GoogleAuth(options);
    this._fetch = async (...args) => {
      const url = args[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opts: any = args[1] ?? {};
      opts.responseType = "stream";
      return await this.gauth.fetch(url, opts);
    };
  }

  get clientType(): string {
    return "gauth";
  }

  async getProjectId(): Promise<string> {
    return this.gauth.getProjectId();
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    return this._request(opts?.url, opts, {});
  }
}
