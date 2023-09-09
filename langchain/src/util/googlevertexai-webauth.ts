import {
  getAccessToken,
  Credentials,
  getCredentials,
} from "web-auth-library/google";
import { getEnvironmentVariable } from "./env.js";
import type { GoogleVertexAIAbstractedClient } from "../types/googlevertexai-types.js";

export interface WebGoogleAuthOptions {
  scopes?: string | string[];
  credentials: Credentials | string;
}

export class WebGoogleAuth implements GoogleVertexAIAbstractedClient {
  scopes: string | string[];

  credentials: Credentials;

  constructor(options?: WebGoogleAuthOptions) {
    this.scopes =
      options?.scopes ?? "https://www.googleapis.com/auth/cloud-platform";

    const credentials =
      options?.credentials ??
      getEnvironmentVariable("GOOGLE_VERTEX_AI_WEB_CREDENTIALS");
    if (credentials === undefined)
      throw new Error(
        `Credentials not found. Please set the GOOGLE_VERTEX_AI_WEB_CREDENTIALS or pass credentials into "authOptions.credentials".`
      );
    this.credentials = getCredentials(credentials);
    console.log(this.credentials);
  }

  async getProjectId() {
    return this.credentials.project_id;
  }

  async request(opts: { url?: string; method?: string; data?: unknown }) {
    const accessToken = await getAccessToken({
      credentials: this.credentials,
      scope: this.scopes,
    });

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

    return {
      data: await res.json(),
      config: {},
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      request: { responseURL: res.url },
    };
  }
}
