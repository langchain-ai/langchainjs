import { Readable } from "stream";
import {
  ensureAuthOptionScopes,
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
  GoogleBaseLLMInput,
  JsonStream,
} from "@langchain/google-common";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";

export class NodeJsonStream extends JsonStream {
  constructor(data: Readable) {
    super();
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
}

export class GAuthClient implements GoogleAbstractedClient {
  gauth: GoogleAuth;

  constructor(fields?: GoogleBaseLLMInput<GoogleAuthOptions>) {
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
      return opts.responseType !== "stream"
        ? ret
        : {
            ...ret,
            data: new NodeJsonStream(ret.data),
          };
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
