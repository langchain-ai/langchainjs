import {
  getAccessToken,
  getCredentials,
  Credentials,
} from "web-auth-library/google";
import { getEnvironmentVariable } from "./env.js";
import type { GoogleVertexAIAbstractedClient } from "../types/googlevertexai-types.js";

export type WebGoogleAuthOptions = {
  credentials: string | Credentials;
  scope?: string | string[];
};

export class WebGoogleAuth implements GoogleVertexAIAbstractedClient {
  options: WebGoogleAuthOptions;

  constructor(options?: WebGoogleAuthOptions) {
    const credentials =
      options?.credentials ??
      getEnvironmentVariable("GOOGLE_VERTEX_AI_WEB_CREDENTIALS");
    if (credentials === undefined)
      throw new Error(
        `Credentials not found. Please set the GOOGLE_VERTEX_AI_WEB_CREDENTIALS or pass credentials into "authOptions.credentials".`
      );

    const scope =
      options?.scope ?? "https://www.googleapis.com/auth/cloud-platform";

    this.options = { ...options, credentials, scope };
  }

  async getProjectId() {
    const credentials = getCredentials(this.options.credentials);
    return credentials.project_id;
  }

  async request(opts: { url?: string; method?: string; data?: unknown }) {
    const accessToken = await getAccessToken(this.options);

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
      data: await res.json(),
      config: {},
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      request: { responseURL: res.url },
    };
  }
}
