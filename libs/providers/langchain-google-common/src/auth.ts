import { ReadableJsonStream } from "./utils/stream.js";
import { GooglePlatformType } from "./types.js";

export type GoogleAbstractedClientOpsMethod = "GET" | "POST" | "DELETE";

export type GoogleAbstractedClientOpsResponseType = "json" | "stream" | "blob";

export type GoogleAbstractedClientOps = {
  url?: string;
  method?: GoogleAbstractedClientOpsMethod;
  headers?: Record<string, string>;
  data?: unknown;
  responseType?: GoogleAbstractedClientOpsResponseType;
};

export interface GoogleAbstractedClient {
  request: (opts: GoogleAbstractedClientOps) => unknown;
  getProjectId: () => Promise<string>;
  get clientType(): string;
}

export abstract class GoogleAbstractedFetchClient
  implements GoogleAbstractedClient
{
  abstract get clientType(): string;

  abstract getProjectId(): Promise<string>;

  abstract request(opts: GoogleAbstractedClientOps): unknown;

  _fetch: typeof fetch = fetch;

  async _buildData(res: Response, opts: GoogleAbstractedClientOps) {
    switch (opts.responseType) {
      case "json":
        return res.json();
      case "stream":
        return new ReadableJsonStream(res.body);
      default:
        return res.blob();
    }
  }

  async _request(
    url: string | undefined,
    opts: GoogleAbstractedClientOps,
    additionalHeaders: Record<string, string>
  ) {
    if (url == null) throw new Error("Missing URL");
    const fetchOptions: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    } = {
      method: opts.method,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
        ...(additionalHeaders ?? {}),
      },
    };
    if (opts.data !== undefined) {
      if (typeof opts.data === "string") {
        fetchOptions.body = opts.data;
      } else {
        fetchOptions.body = JSON.stringify(opts.data);
      }
    }

    const res = await this._fetch(url, fetchOptions);

    if (!res.ok) {
      const resText = await res.text();
      const error = new Error(
        `Google request failed with status code ${res.status}: ${resText}`
      );
      /* eslint-disable @typescript-eslint/no-explicit-any */
      (error as any).response = res;
      (error as any).details = {
        url,
        opts,
        fetchOptions,
        result: res,
      };
      /* eslint-enable @typescript-eslint/no-explicit-any */
      throw error;
    }

    const data = await this._buildData(res, opts);
    return {
      data,
      config: {},
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      request: { responseURL: res.url },
    };
  }
}

export class ApiKeyGoogleAuth extends GoogleAbstractedFetchClient {
  apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  get clientType(): string {
    return "apiKey";
  }

  getProjectId(): Promise<string> {
    throw new Error("APIs that require a project ID cannot use an API key");
    // Perhaps we could implement this if needed:
    // https://cloud.google.com/docs/authentication/api-keys#get-info
  }

  request(opts: GoogleAbstractedClientOps): unknown {
    const authHeader = {
      "X-Goog-Api-Key": this.apiKey,
    };
    return this._request(opts.url, opts, authHeader);
  }
}

export function aiPlatformScope(platform: GooglePlatformType): string[] {
  switch (platform) {
    case "gai":
      return ["https://www.googleapis.com/auth/generative-language"];
    default:
      return ["https://www.googleapis.com/auth/cloud-platform"];
  }
}

export function ensureAuthOptionScopes<AuthOptions>(
  authOption: AuthOptions | undefined,
  scopeProperty: string,
  scopesOrPlatform: string[] | GooglePlatformType | undefined
): AuthOptions {
  // If the property is already set, return it
  if (authOption && Object.hasOwn(authOption, scopeProperty)) {
    return authOption;
  }

  // Otherwise add it
  const scopes: string[] = Array.isArray(scopesOrPlatform)
    ? (scopesOrPlatform as string[])
    : aiPlatformScope(scopesOrPlatform ?? "gcp");
  return {
    [scopeProperty]: scopes,
    ...(authOption ?? {}),
  } as AuthOptions;
}
