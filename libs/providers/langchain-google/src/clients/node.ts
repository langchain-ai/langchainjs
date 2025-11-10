import { GoogleAuth, type GoogleAuthOptions } from "google-auth-library";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { GOOGLE_API_KEY_HEADER } from "../const.js";
import { ApiClient } from "./index.js";

export interface NodeApiClientParams {
  apiKey?: string;
  googleAuthOptions?: GoogleAuthOptions;
}

export class NodeApiClient extends ApiClient {
  protected apiKey?: string;
  protected googleAuth?: GoogleAuth;

  constructor(protected params: NodeApiClientParams = {}) {
    super();

    this.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");

    if (params.googleAuthOptions) {
      this.googleAuth = new GoogleAuth(params.googleAuthOptions);
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (this.apiKey) {
      request.headers.set(GOOGLE_API_KEY_HEADER, this.apiKey);
    } else if (this.googleAuth) {
      const authHeaders = await this.googleAuth.getRequestHeaders(request.url);
      authHeaders.forEach((value, key) => {
        if (value !== null) {
          request.headers.set(key, value);
        }
      });
    }
    return fetch(request);
  }
}

export function ensureAuthScopes(
  authOptions: GoogleAuthOptions,
  requiredScopes: string[]
): GoogleAuthOptions {
  if (!authOptions) {
    return { scopes: requiredScopes };
  } else if (!authOptions.scopes) {
    return { ...authOptions, scopes: requiredScopes };
  } else {
    const existingScopes = Array.isArray(authOptions.scopes)
      ? authOptions.scopes
      : [authOptions.scopes];
    const missingScopes = requiredScopes.filter(
      (scope) => !existingScopes.includes(scope)
    );
    if (missingScopes.length > 0) {
      throw new Error(
        `Invalid auth scopes. Scopes must include ${requiredScopes.join(", ")}`
      );
    }
  }
  return authOptions;
}
