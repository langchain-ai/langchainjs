import { Readable } from "stream";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";
import {
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
} from "../types/googlevertexai-types.js";
import { GoogleVertexAIStream } from "./googlevertexai-connection.js";

class GoogleVertexAINodeStream extends GoogleVertexAIStream {
  constructor(data: Readable) {
    super();

    data.on("data", (data) => this.appendBuffer(data.toString()));
    data.on("end", () => this.closeBuffer());
  }
}

export class GAuthClient implements GoogleAbstractedClient {
  gauth: GoogleAuth;

  constructor(options?: GoogleAuthOptions) {
    this.gauth = new GoogleAuth(options);
  }

  async getProjectId(): Promise<string> {
    return this.gauth.getProjectId();
  }

  async request(opts: GoogleAbstractedClientOps): Promise<unknown> {
    const ret = await this.gauth.request(opts);
    return opts.responseType !== "stream"
      ? ret
      : {
          ...ret,
          data: new GoogleVertexAINodeStream(ret.data),
        };
  }
}
