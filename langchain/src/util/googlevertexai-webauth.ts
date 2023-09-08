import { OAuth2Client } from "google-auth-library";
import {
  getAccessToken,
  Credentials,
  getCredentials,
} from "web-auth-library/google";
import { getEnvironmentVariable } from "./env.js";

export interface WebGoogleAuthOptions {
  scopes: string | string[];
  credentials: Credentials | string;
}

export class WebGoogleAuth {
  scopes: string | string[];

  credentials: Credentials;

  constructor(options?: WebGoogleAuthOptions) {
    this.scopes =
      options?.scopes ?? "https://www.googleapis.com/auth/cloud-platform";

    const credentials =
      options?.credentials ??
      getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS");
    if (!credentials) throw new Error("GOOGLE_CLOUD_CREDENTIALS not found");
    this.credentials = getCredentials(credentials);
  }

  async getProjectId() {
    return this.credentials.project_id;
  }

  async getClient() {
    const request: OAuth2Client["request"] = async <T>(opts: {
      url?: string;
      method?: string;
      data?: unknown;
    }) => {
      const accessToken = await getAccessToken({
        credentials: this.credentials,
        scope: this.scopes,
      });

      if (opts.url == null) throw new Error("Missing URL");
      const res = await fetch(opts.url, {
        method: opts.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(opts.data),
      });

      return {
        data: (await res.json()) as T,
        config: {},
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        request: { responseURL: res.url },
      };
    };

    return { request };
  }
}
