import { GoogleAuth, type GoogleAuthOptions } from "google-auth-library";
import type { GoogleVertexAIAbstractedClient } from "../types/googlevertexai-types.js";
import { IterableReadableStream } from "./stream.js";

export class NodeGoogleAuth implements GoogleVertexAIAbstractedClient {
  client: GoogleAuth;

  constructor(options: GoogleAuthOptions) {
    this.client = new GoogleAuth(options);
  }

  request(opts: { url?: string; method?: "GET" | "POST"; data?: unknown; }) {
    return this.client.request(opts);
  }

  getProjectId() {
    return this.client.getProjectId();
  }

  async *stream(opts: { url?: string; method?: "GET" | "POST"; data?: unknown; }) {
    const accessToken = await this.client.getAccessToken();

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
      const json = await res.json();
      let error;
      if (Array.isArray(json) && json.length > 0) {
        error = new Error(`${json[0].error?.code}: ${json[0].error?.message}`);
      } else {
        error = new Error(`Failed to start stream.`);
      }
      (error as any).response = res;
      throw error;
    }

    if (!res.body) {
      throw new Error("No body returned in VertexAI stream request.");
    }

    const decoder = new TextDecoder();
    const stream = IterableReadableStream.fromReadableStream(res.body);
    let streamBuffer = "";
    for await (const chunk of stream) {
      if (!chunk) {
        continue;
      }
      const decodedChunk = decoder.decode(chunk);
      streamBuffer += decodedChunk;
      if (streamBuffer.startsWith("[")) {
        streamBuffer = streamBuffer.slice(1);
      }
      console.log(decoder.decode(chunk));
      yield decoder.decode(chunk);
    }
  }
}
