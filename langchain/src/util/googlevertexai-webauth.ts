import {
  getAccessToken,
  Credentials,
  getCredentials,
} from "web-auth-library/google";
import { getEnvironmentVariable } from "./env.js";
import type { GoogleVertexAIAbstractedClient } from "../types/googlevertexai-types.js";

export type WebGoogleAuthOptions = Pick<
  Parameters<typeof getAccessToken>[0],
  "credentials" | "scope"
>;

export class WebGoogleAuth implements GoogleVertexAIAbstractedClient {
  options: WebGoogleAuthOptions;

  #credentials: Credentials;

  constructor(options?: WebGoogleAuthOptions) {
    const credentials =
      options?.credentials ??
      getEnvironmentVariable("GOOGLE_VERTEX_AI_WEB_CREDENTIALS");
    if (credentials === undefined)
      throw new Error(
        `Credentials not found. Please set the GOOGLE_VERTEX_AI_WEB_CREDENTIALS or pass credentials into "authOptions.credentials".`
      );

    const scope =
      options?.scope ??
      getEnvironmentVariable("GOOGLE_VERTEX_AI_WEB_SCOPE") ??
      "https://www.googleapis.com/auth/cloud-platform";

    this.#credentials = getCredentials(credentials);
    this.options = { ...options, credentials, scope };
  }

  async getProjectId() {
    return this.#credentials.project_id;
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
