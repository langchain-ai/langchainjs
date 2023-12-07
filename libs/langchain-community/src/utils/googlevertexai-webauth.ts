import {
  getAccessToken,
  getCredentials,
  Credentials,
} from "web-auth-library/google";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import type {
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
} from "../types/googlevertexai-types.js";
import { GoogleVertexAIStream } from "./googlevertexai-connection.js";

class GoogleVertexAIResponseStream extends GoogleVertexAIStream {
  decoder: TextDecoder;

  constructor(body: ReadableStream | null) {
    super();
    this.decoder = new TextDecoder();
    if (body) {
      void this.run(body);
    } else {
      console.error("Unexpected empty body while streaming");
    }
  }

  async run(body: ReadableStream) {
    const reader = body.getReader();
    let isDone = false;
    while (!isDone) {
      const { value, done } = await reader.read();
      if (!done) {
        const svalue = this.decoder.decode(value);
        this.appendBuffer(svalue);
      } else {
        isDone = done;
        this.closeBuffer();
      }
    }
  }
}

export type WebGoogleAuthOptions = {
  credentials: string | Credentials;
  scope?: string | string[];
  accessToken?: string;
};

export class WebGoogleAuth implements GoogleAbstractedClient {
  options: WebGoogleAuthOptions;

  constructor(options?: WebGoogleAuthOptions) {
    const accessToken = options?.accessToken;

    const credentials =
      options?.credentials ??
      getEnvironmentVariable("GOOGLE_VERTEX_AI_WEB_CREDENTIALS");
    if (credentials === undefined)
      throw new Error(
        `Credentials not found. Please set the GOOGLE_VERTEX_AI_WEB_CREDENTIALS environment variable or pass credentials into "authOptions.credentials".`
      );

    const scope =
      options?.scope ?? "https://www.googleapis.com/auth/cloud-platform";

    this.options = { ...options, accessToken, credentials, scope };
  }

  async getProjectId() {
    const credentials = getCredentials(this.options.credentials);
    return credentials.project_id;
  }

  async request(opts: GoogleAbstractedClientOps) {
    let { accessToken } = this.options;

    if (accessToken === undefined) {
      accessToken = await getAccessToken(this.options);
    }

    if (opts.url == null) throw new Error("Missing URL");
    const fetchOptions: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    };
    if (opts.data !== undefined) {
      fetchOptions.body = JSON.stringify(opts.data);
    }

    const res = await fetch(opts.url, fetchOptions);

    if (!res.ok) {
      const error = new Error(
        `Could not get access token for Vertex AI with status code: ${res.status}`
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = res;
      throw error;
    }

    return {
      data:
        opts.responseType === "json"
          ? await res.json()
          : new GoogleVertexAIResponseStream(res.body),
      config: {},
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      request: { responseURL: res.url },
    };
  }
}
