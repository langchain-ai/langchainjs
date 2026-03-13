import { GoogleAuth, type GoogleAuthOptions } from "google-auth-library";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { GCP_API_KEY_HEADER, GOOGLE_API_KEY_HEADER } from "../const.js";
import { ApiClient } from "./index.js";
import {
  GCPCredentials,
  getGCPCredentialsAccessToken,
  normalizeGCPCredentials,
} from "../utils/gcp-auth.js";
import { ConfigurationError } from "../utils/errors.js";
import { iife } from "../utils/misc.js";

/**
 * Configuration parameters for the NodeApiClient.
 *
 * This interface defines the authentication options available for Node.js-based
 * API clients. Authentication can be provided via an API key, GCP service
 * account credentials, or advanced Google Auth options. The client will
 * automatically check environment variables if explicit values are not provided.
 *
 * @interface
 */
export interface NodeApiClientParams {
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
   * Provides fine-grained control over authentication behavior using the
   * google-auth-library. This option enables:
   * - Custom OAuth2 scopes
   * - Application Default Credentials (ADC)
   * - Impersonation and delegation
   * - Custom credential sources
   *
   * When provided, this takes precedence over simple credential-based auth
   * but is lower priority than API key authentication.
   *
   * @see https://github.com/googleapis/google-auth-library-nodejs
   * @see https://cloud.google.com/docs/authentication/application-default-credentials
   */
  googleAuthOptions?: GoogleAuthOptions;
}

/**
 * Node.js-specific API client for Google services.
 *
 * This client provides comprehensive authentication for Google API requests in
 * Node.js environments, leveraging the full capabilities of the google-auth-library.
 * It supports three authentication methods with the following priority:
 *
 * 1. **API Key Authentication**: Simple key-based authentication suitable for
 *    public APIs and development environments.
 *
 * 2. **Service Account Credentials**: OAuth2-based authentication using GCP
 *    service account keys. The client automatically handles token generation
 *    and caching using a web-compatible implementation.
 *
 * 3. **Google Auth Library**: Advanced authentication using google-auth-library,
 *    supporting Application Default Credentials (ADC), custom scopes, and
 *    various credential sources.
 *
 * The client follows this authentication priority:
 * 1. Explicit `apiKey` parameter
 * 2. `GOOGLE_API_KEY` environment variable
 * 3. Explicit `credentials` parameter
 * 4. `GOOGLE_CLOUD_CREDENTIALS` environment variable
 * 5. `googleAuthOptions` parameter
 * 6. Application Default Credentials (if googleAuthOptions is provided without explicit credentials)
 *
 * @extends ApiClient
 *
 * @example
 * ```typescript
 * // Using API key
 * const client = new NodeApiClient({
 *   apiKey: 'your-api-key'
 * });
 *
 * // Using service account credentials
 * const client = new NodeApiClient({
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
 * // Using Google Auth with custom scopes
 * const client = new NodeApiClient({
 *   googleAuthOptions: {
 *     scopes: ['https://www.googleapis.com/auth/cloud-platform'],
 *     keyFilename: '/path/to/service-account-key.json'
 *   }
 * });
 *
 * // Using Application Default Credentials
 * const client = new NodeApiClient({
 *   googleAuthOptions: {}
 * });
 *
 * // Using environment variables
 * // Set GOOGLE_API_KEY or GOOGLE_CLOUD_CREDENTIALS
 * const client = new NodeApiClient();
 *
 * // Make authenticated requests
 * const request = new Request('https://api.google.com/...');
 * const response = await client.fetch(request);
 * ```
 *
 * @remarks
 * - API keys are added via the `X-Goog-Api-Key` header
 * - Service account tokens are added via the `Authorization` header with Bearer scheme
 * - Google Auth headers are automatically generated and added by google-auth-library
 * - Tokens are automatically cached and refreshed as needed
 * - For web/edge environments without google-auth-library, use WebApiClient instead
 *
 * @see {@link WebApiClient} for web-compatible authentication without google-auth-library
 * @see {@link GCPCredentials} for service account credential structure
 * @see {@link GoogleAuthOptions} for advanced authentication configuration
 */
export class NodeApiClient extends ApiClient {
  hasApiKey(): boolean {
    return typeof this.apiKey === "string" && this.apiKey !== "";
  }

  async getProjectId(): Promise<string> {
    if (typeof this.credentials !== "undefined") {
      return this.credentials.project_id;
    } else if (typeof this.googleAuth !== "undefined") {
      return this.googleAuth.getProjectId();
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
   * The Google Auth instance for advanced authentication, if configured.
   *
   * This instance is created when `googleAuthOptions` is provided and
   * handles Application Default Credentials, custom scopes, and other
   * advanced authentication scenarios.
   *
   * @protected
   */
  protected googleAuth?: GoogleAuth;

  /**
   * Creates a new NodeApiClient instance.
   *
   * The constructor initializes authentication credentials by checking:
   * 1. Explicit parameters passed to the constructor
   * 2. Environment variables (`GOOGLE_API_KEY`, `GOOGLE_CLOUD_CREDENTIALS`)
   * 3. Application Default Credentials (if googleAuthOptions is provided)
   *
   * Credentials are normalized and frozen to prevent accidental modification.
   * The GoogleAuth instance is lazily initialized only when googleAuthOptions
   * is provided.
   *
   * @param params - Configuration parameters for the client. Defaults to an empty object.
   *
   * @example
   * ```typescript
   * // Minimal configuration (uses environment variables or ADC)
   * const client = new NodeApiClient();
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
   * const client = new NodeApiClient({
   *   credentials: {
   *     type: "service_account",
   *     // ... other fields
   *   }
   * });
   *
   * // With Google Auth options
   * const client = new NodeApiClient({
   *   googleAuthOptions: {
   *     scopes: ['https://www.googleapis.com/auth/cloud-platform'],
   *     projectId: 'my-project'
   *   }
   * });
   * ```
   */
  constructor(protected params: NodeApiClientParams = {}) {
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
    this.googleAuth = iife(() => {
      if (params.googleAuthOptions) {
        return new GoogleAuth(params.googleAuthOptions);
      }
      if (!this.apiKey && !this.credentials) {
        return new GoogleAuth();
      }
      return undefined;
    });
  }

  /**
   * Executes an HTTP request with appropriate Google API authentication.
   *
   * This method adds authentication headers to the request based on the
   * configured authentication method, following this priority:
   *
   * 1. If an API key is configured, adds the `X-Goog-Api-Key` header
   * 2. If service account credentials are configured, generates an access token
   *    and adds it via the `Authorization` header with Bearer scheme
   * 3. If Google Auth is configured, uses google-auth-library to generate
   *    appropriate authentication headers (may include Authorization, x-goog-user-project, etc.)
   *
   * The authentication priority ensures that explicit API keys take precedence,
   * followed by service account credentials, and finally Google Auth options.
   *
   * @param request - The HTTP request to execute. Headers will be modified
   *                  in-place to include authentication information.
   * @returns A Promise that resolves to the HTTP response
   *
   * @throws {AuthError} If service account authentication fails (e.g., invalid
   *                     credentials, network error, or token generation failure)
   * @throws {Error} If Google Auth authentication fails (e.g., missing credentials,
   *                 invalid configuration, or ADC not available)
   *
   * @example
   * ```typescript
   * const client = new NodeApiClient({ apiKey: 'your-key' });
   * const request = new Request('https://generativelanguage.googleapis.com/v1/models');
   * const response = await client.fetch(request);
   * const data = await response.json();
   * ```
   *
   * @remarks
   * - The request object is modified in-place by adding headers
   * - Service account tokens are automatically cached and refreshed
   * - Google Auth tokens are managed by google-auth-library with automatic refresh
   * - Only one authentication method is used per request (based on priority)
   * - Google Auth may add multiple headers depending on the authentication type
   */
  async fetch(request: Request): Promise<Response> {
    if (this.apiKey) {
      request.headers.set(GOOGLE_API_KEY_HEADER, this.apiKey);
    } else if (this.credentials) {
      request.headers.set(
        GCP_API_KEY_HEADER,
        `Bearer ${getGCPCredentialsAccessToken(this.credentials)}`
      );
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

/**
 * Ensures that Google Auth options include required OAuth2 scopes.
 *
 * This utility function validates and augments GoogleAuthOptions to ensure
 * that all required OAuth2 scopes are present. It handles three scenarios:
 *
 * 1. **No auth options provided**: Creates new options with required scopes
 * 2. **Auth options without scopes**: Adds required scopes to existing options
 * 3. **Auth options with scopes**: Validates that all required scopes are present
 *
 * This is particularly useful when working with Google APIs that require specific
 * scopes for access, ensuring that authentication is properly configured before
 * making API requests.
 *
 * @param authOptions - The existing Google Auth options to validate/augment.
 *                      Can be undefined or an empty object.
 * @param requiredScopes - Array of OAuth2 scope URLs that must be present.
 *                         These are typically Google API scope URLs like
 *                         'https://www.googleapis.com/auth/cloud-platform'
 * @returns The validated/augmented GoogleAuthOptions with all required scopes
 *
 * @throws {Error} If authOptions already has scopes but is missing any of the
 *                 required scopes. This prevents accidental scope reduction that
 *                 could break API access.
 *
 * @example
 * ```typescript
 * // Create new options with required scopes
 * const options = ensureAuthScopes(undefined, [
 *   'https://www.googleapis.com/auth/cloud-platform'
 * ]);
 * // Result: { scopes: ['https://www.googleapis.com/auth/cloud-platform'] }
 *
 * // Add scopes to existing options
 * const options = ensureAuthScopes(
 *   { projectId: 'my-project' },
 *   ['https://www.googleapis.com/auth/cloud-platform']
 * );
 * // Result: { projectId: 'my-project', scopes: [...] }
 *
 * // Validate existing scopes
 * const options = ensureAuthScopes(
 *   { scopes: ['https://www.googleapis.com/auth/cloud-platform'] },
 *   ['https://www.googleapis.com/auth/cloud-platform']
 * );
 * // Result: Original options (validation passed)
 *
 * // Error case - missing required scope
 * try {
 *   ensureAuthScopes(
 *     { scopes: ['https://www.googleapis.com/auth/userinfo.email'] },
 *     ['https://www.googleapis.com/auth/cloud-platform']
 *   );
 * } catch (error) {
 *   // Error: Invalid auth scopes. Scopes must include ...
 * }
 * ```
 *
 * @remarks
 * - Scopes can be provided as a string or array of strings in GoogleAuthOptions
 * - The function normalizes single-string scopes to arrays for validation
 * - Required scopes are not automatically added if existing scopes are present;
 *   instead, an error is thrown to prevent unintended scope changes
 * - This function does not modify the original authOptions object
 *
 * @see https://developers.google.com/identity/protocols/oauth2/scopes
 * @see {@link GoogleAuthOptions} for the full authentication configuration interface
 */
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
      throw new ConfigurationError(
        `Invalid auth scopes. Scopes must include ${requiredScopes.join(", ")}`
      );
    }
  }
  return authOptions;
}
