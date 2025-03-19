import { Readable } from "stream";
import {
  AbstractStream,
  ensureAuthOptionScopes,
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
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

export class GAuthClient implements GoogleAbstractedClient {
  gauth: GoogleAuth;

  constructor(fields?: GoogleConnectionParams<GoogleAuthOptions>) {
    const options = ensureAuthOptionScopes<GoogleAuthOptions>(
      fields?.authOptions,
      "scopes",
      fields?.platformType
    );
    this.gauth = new GoogleAuth(options);
  }

  get clientType(): string {
    return "gauth";
  }

  async getProjectId(): Promise<string> {
    return this.gauth.getProjectId();
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    try {
      const ret = await this.gauth.request(opts);
      const [contentType] = ret?.headers?.["content-type"]?.split(/;/) ?? [""];
      if (opts.responseType !== "stream") {
        return ret;
      } else if (contentType === "text/event-stream") {
        return {
          ...ret,
          data: new NodeSseJsonStream(ret.data),
        };
      } else {
        return {
          ...ret,
          data: new NodeJsonStream(ret.data),
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (xx: any) {
      console.error("call to gauth.request", JSON.stringify(xx, null, 2));
      console.error(
        "call to gauth.request opts=",
        JSON.stringify(opts, null, 2)
      );
      console.error("call to gauth.request message:", xx?.message);
      throw xx;
    }
  }
}
