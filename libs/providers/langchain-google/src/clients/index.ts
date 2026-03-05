import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { GCP_API_KEY_HEADER, GOOGLE_API_KEY_HEADER } from "../const.js";
import {
  GCPCredentials,
  getGCPCredentialsAccessToken,
  normalizeGCPCredentials,
} from "../utils/gcp-auth.js";
import { AuthError } from "../utils/errors.js";
import { iife } from "../utils/misc.js";

/**
 * Abstract base class for API clients that interact with Google services.
 *
 * This class defines the contract for API clients, requiring implementations
 * to provide a fetch method that handles HTTP requests with appropriate
 * authentication headers. Concrete implementations should handle different
 * authentication strategies (API keys, service account credentials, etc.)
 * based on the runtime environment.
 *
 * @abstract
 *
 * @example
 * ```typescript
 * class MyApiClient extends ApiClient {
 *   async fetch(request: Request): Promise<Response> {
 *     // Add authentication headers
 *     request.headers.set('Authorization', 'Bearer token');
 *     return fetch(request);
 *   }
 * }
 * ```
 */
export abstract class ApiClient {
  /**
   * Has an API Key been set for this client?
   */
  abstract hasApiKey(): boolean;

  /**
   * For some credential methods, we know what the project ID is.
   * This is necessary for OAuth-based access to Vertex
   */
  async getProjectId(): Promise<string> {
    return "unknown-project-id";
  }

  /**
   * Executes an HTTP request with appropriate authentication.
   *
   * Implementations should add necessary authentication headers to the request
   * before forwarding it to the underlying fetch implementation.
   *
   * @param request - The HTTP request to execute
   * @returns A Promise that resolves to the HTTP response
   *
   * @abstract
   */
  abstract fetch(request: Request): Promise<Response>;
}

/**
 * Configuration parameters for the WebApiClient.
 *
 * This interface defines the authentication options available for web-based
 * API clients. Authentication can be provided via an API key or GCP service
 * account credentials. The client will automatically check environment variables
 * if explicit values are not provided.
 *
 * @interface
 */
export interface WebApiClientParams {
  /**
   * Google API key for authentication.
   *
   * If not provided, the client will attempt to read from the
   * `GOOGLE_API_KEY` environment variable.
   *
   * @see https://cloud.google.com/docs/authentication/api-keys
   */
  apiKey?: string;

  /**
   * GCP service account credentials for authentication.
   *
   * Can be provided as either:
   * - A JSON string containing the service account key
   * - A GCPCredentials object
   *
   * If not provided, the client will attempt to read from the
   * `GOOGLE_CLOUD_CREDENTIALS` environment variable.
   *
   * @see https://cloud.google.com/iam/docs/creating-managing-service-account-keys
   */
  credentials?: string | GCPCredentials;

  /**
   * Google Auth options configuration.
   *
   * @deprecated This option is not supported in web environments.
   *             Import from `@langchain/google/node` to configure google auth options
   *             using the NodeApiClient instead.
   */
  googleAuthOptions?: never;
}

/**
 * Web-compatible API client for Google services.
 *
 * This client provides authentication for Google API requests in web environments
 * (browsers, edge functions, etc.) where the google-auth-library is not available.
 * It supports two authentication methods:
 *
 * 1. **API Key Authentication**: Simple key-based authentication suitable for
 *    public APIs and client-side applications.
 *
 * 2. **Service Account Credentials**: OAuth2-based authentication using GCP
 *    service account keys. The client automatically handles token generation
 *    and caching.
 *
 * The client follows this authentication priority:
 * 1. Explicit `apiKey` parameter
 * 2. `GOOGLE_API_KEY` environment variable
 * 3. Explicit `credentials` parameter
 * 4. `GOOGLE_CLOUD_CREDENTIALS` environment variable
 *
 * @extends ApiClient
 *
 * @example
 * ```typescript
 * // Using API key
 * const client = new WebApiClient({
 *   apiKey: 'your-api-key'
 * });
 *
 * // Using service account credentials
 * const client = new WebApiClient({
 *   credentials: {
 *     type: "service_account",
 *     project_id: "my-project",
 *     private_key_id: "key-id",
 *     private_key: "-----BEGIN PRIVATE KEY-----\n...",
 *     client_email: "service-account@project.iam.gserviceaccount.com",
 *     // ... other required fields
 *   }
 * });
 *
 * // Using environment variables
 * // Set GOOGLE_API_KEY or GOOGLE_CLOUD_CREDENTIALS
 * const client = new WebApiClient({});
 *
 * // Make authenticated requests
 * const request = new Request('https://api.google.com/...');
 * const response = await client.fetch(request);
 * ```
 *
 * @remarks
 * - API keys are added via the `X-Goog-Api-Key` header
 * - Service account tokens are added via the `Authorization` header with Bearer scheme
 * - Tokens are automatically cached and refreshed as needed
 * - For Node.js environments with advanced auth requirements, use NodeApiClient instead
 *
 * @see {@link NodeApiClient} for Node.js-specific authentication options
 * @see {@link GCPCredentials} for service account credential structure
 */
export class WebApiClient extends ApiClient {
  hasApiKey(): boolean {
    return typeof this.apiKey === "string" && this.apiKey !== "";
  }

  async getProjectId(): Promise<string> {
    if (typeof this.credentials !== "undefined") {
      return this.credentials.project_id;
    } else {
      return super.getProjectId();
    }
  }

  /**
   * The Google API key used for authentication, if provided.
   *
   * This value is resolved from either the constructor parameter or the
   * `GOOGLE_API_KEY` environment variable.
   *
   * @protected
   */
  protected apiKey?: string;

  /**
   * The normalized GCP service account credentials, if provided.
   *
   * This value is resolved from either the constructor parameter or the
   * `GOOGLE_CLOUD_CREDENTIALS` environment variable, and is normalized
   * to ensure immutability.
   *
   * @protected
   */
  protected credentials?: GCPCredentials;

  /**
   * Creates a new WebApiClient instance.
   *
   * The constructor initializes authentication credentials by checking:
   * 1. Explicit parameters passed to the constructor
   * 2. Environment variables (`GOOGLE_API_KEY`, `GOOGLE_CLOUD_CREDENTIALS`)
   *
   * Credentials are normalized and frozen to prevent accidental modification.
   *
   * @param params - Configuration parameters for the client
   *
   * @example
   * ```typescript
   * // Minimal configuration (uses environment variables)
   * const client = new WebApiClient({});
   *
   * // With explicit API key
   * const client = new WebApiClient({
   *   apiKey: 'your-api-key'
   * });
   *
   * // With service account credentials as JSON string
   * const client = new WebApiClient({
   *   credentials: '{"type":"service_account",...}'
   * });
   *
   * // With service account credentials as object
   * const client = new WebApiClient({
   *   credentials: {
   *     type: "service_account",
   *     // ... other fields
   *   }
   * });
   * ```
   */
  constructor(protected params: WebApiClientParams) {
    super();
    this.apiKey = params.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
    this.credentials = iife(() => {
      if (params.credentials) {
        return normalizeGCPCredentials(params.credentials);
      }
      const credentialsVar = getEnvironmentVariable("GOOGLE_CLOUD_CREDENTIALS");
      if (credentialsVar) {
        return normalizeGCPCredentials(credentialsVar);
      }
      return undefined;
    });
  }

  /**
   * Executes an HTTP request with appropriate Google API authentication.
   *
   * This method adds authentication headers to the request based on the
   * configured authentication method:
   *
   * - If an API key is configured, adds the `X-Goog-Api-Key` header
   * - If service account credentials are configured, generates an access token
   *   and adds it via the `Authorization` header with Bearer scheme
   *
   * The authentication priority is:
   * 1. API key (if provided)
   * 2. Service account credentials (if provided)
   *
   * @param request - The HTTP request to execute. Headers will be modified
   *                  in-place to include authentication information.
   * @returns A Promise that resolves to the HTTP response
   *
   * @throws {AuthError} If no authentication method is available (neither apiKey
   *                     nor credentials), or if service account authentication
   *                     fails (e.g., invalid credentials, network error, or
   *                     token generation failure)
   *
   * @example
   * ```typescript
   * const client = new WebApiClient({ apiKey: 'your-key' });
   * const request = new Request('https://generativelanguage.googleapis.com/v1/models');
   * const response = await client.fetch(request);
   * const data = await response.json();
   * ```
   *
   * @remarks
   * - The request object is modified in-place by adding headers
   * - Service account tokens are automatically cached and refreshed
   * - If both API key and credentials are provided, API key takes precedence
   */
  async fetch(request: Request): Promise<Response> {
    if (!this.apiKey && !this.credentials) {
      throw new AuthError({
        message:
          "No authentication method available. Please provide either an apiKey or credentials.",
      });
    }
    if (this.apiKey) {
      request.headers.set(GOOGLE_API_KEY_HEADER, this.apiKey);
    }
    if (this.credentials) {
      request.headers.set(
        GCP_API_KEY_HEADER,
        `Bearer ${await getGCPCredentialsAccessToken(this.credentials)}`
      );
    }
    return fetch(request);
  }
}
