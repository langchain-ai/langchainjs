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
  signal?: AbortSignal;
};

export interface GoogleAbstractedClient {
  request: (opts: GoogleAbstractedClientOps) => unknown;
  getProjectId: () => Promise<string>;
  get clientType(): string;
}

export abstract class GoogleAbstractedFetchClient implements GoogleAbstractedClient {
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

  /**
   * Build and throw a standardised Google request error.
   * Both the `!res.ok` path (native fetch) and the catch path (gaxios)
   * funnel through here so the caller always sees the same shape.
   */
  protected _throwRequestError(
    status: number,
    body: string | undefined,
    response: unknown,
    context: {
      url: string;
      opts: GoogleAbstractedClientOps;
      fetchOptions?: Record<string, unknown>;
    }
  ): never {
    const message = body
      ? `Google request failed with status code ${status}: ${body}`
      : `Google request failed with status code ${status}`;
    const error = new Error(message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).response = response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (error as any).details = context;
    throw error;
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
      signal?: AbortSignal;
    } = {
      method: opts.method,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers ?? {}),
        ...(additionalHeaders ?? {}),
      },
      signal: opts.signal,
    };
    if (opts.data !== undefined) {
      if (typeof opts.data === "string") {
        fetchOptions.body = opts.data;
      } else {
        fetchOptions.body = JSON.stringify(opts.data);
      }
    }

    const context = { url, opts, fetchOptions };

    let res: Response;
    try {
      res = await this._fetch(url, fetchOptions);
    } catch (fetchError) {
      // The _fetch implementation (e.g. GAuthClient using google-auth-library)
      // may throw its own error (e.g. GaxiosError) for non-2xx responses
      // before we can handle them here. Extract what we can from the error
      // and re-throw with a useful, formatted message.
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const err = fetchError as any;
      const status = err?.response?.status ?? err?.status;

      if (status != null) {
        let body: string | undefined;

        if (err?.response?.data != null) {
          if (typeof err.response.data === "string") {
            body = err.response.data;
          } else if (typeof err.response.data === "object") {
            try {
              body = JSON.stringify(err.response.data);
            } catch {
              // best effort
            }
          }
        }

        this._throwRequestError(
          status,
          body,
          err?.response ?? { status },
          context
        );
      }

      // No status info available — re-throw the original error as-is
      throw fetchError;
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    if (!res.ok) {
      const body = await res.text();
      this._throwRequestError(res.status, body, res, context);
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
