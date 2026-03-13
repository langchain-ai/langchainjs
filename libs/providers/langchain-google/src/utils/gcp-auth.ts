/**
 * GCP authentication utilities.
 *
 * Adapted from: https://github.com/kriasoft/web-auth-library
 * Original source: web-auth-library by Kriasoft
 * License: MIT (https://github.com/kriasoft/web-auth-library/blob/main/LICENSE)
 */

import { decodeJwt, importPKCS8, SignJWT } from "jose";
import { AuthError } from "../utils/errors.js";
import { iife } from "../utils/misc.js";

/**
 * Google Cloud Platform service account credentials interface.
 *
 * This interface represents the structure of a GCP service account key file,
 * which is used for authenticating with Google Cloud APIs. Service account
 * keys can be downloaded from the Google Cloud Console and contain all the
 * information needed to authenticate as a service account.
 *
 * @see https://cloud.google.com/iam/docs/creating-managing-service-account-keys
 */
export interface GCPCredentials {
  /** The type of credential, typically "service_account" */
  type: string;
  /** The GCP project ID associated with this service account */
  project_id: string;
  /** The unique identifier for the private key */
  private_key_id: string;
  /** The RSA private key in PEM format used for signing JWTs */
  private_key: string;
  /** The unique client ID for this service account */
  client_id: string;
  /** The email address of the service account */
  client_email: string;
  /** The OAuth2 authorization endpoint URI */
  auth_uri: string;
  /** The OAuth2 token endpoint URI where access tokens are requested */
  token_uri: string;
  /** The URL for the OAuth2 provider's x509 certificate */
  auth_provider_x509_cert_url: string;
  /** The URL for this service account's x509 certificate */
  client_x509_cert_url: string;
}

interface CacheValue {
  /** Unix timestamp (in seconds) when this cache entry was created */
  created: number;
  /** Promise that resolves to the token and its expiration time */
  promise: Promise<{ token: string; expires: number }>;
}

const cache = new Map<string, CacheValue>();
const CACHE_MAX_AGE = 60 * 60; // 1 hour

/**
 * Normalizes GCP credentials to a frozen GCPCredentials object.
 *
 * This function accepts credentials in either string (JSON) or object format
 * and ensures the returned value is a frozen (immutable) GCPCredentials object.
 * Freezing the credentials prevents accidental modification and ensures
 * consistency throughout the application lifecycle.
 *
 * @param credentials - The GCP service account credentials, either as a JSON string
 *                      or as a GCPCredentials object
 * @returns A frozen GCPCredentials object that cannot be modified
 *
 * @example
 * ```typescript
 * // From JSON string
 * const creds = normalizeGCPCredentials('{"type":"service_account",...}');
 *
 * // From object
 * const creds = normalizeGCPCredentials({
 *   type: "service_account",
 *   project_id: "my-project",
 *   // ... other fields
 * });
 * ```
 */
export function normalizeGCPCredentials(
  credentials: string | GCPCredentials
): GCPCredentials {
  return typeof credentials === "string"
    ? Object.freeze(JSON.parse(credentials))
    : Object.isFrozen(credentials)
    ? credentials
    : Object.freeze(credentials);
}

/**
 * Imports and returns the private key from GCP credentials for JWT signing.
 *
 * This function extracts the RSA private key from the service account credentials
 * and imports it using the PKCS#8 format with the RS256 algorithm. The returned
 * key can be used to sign JWTs for authentication with Google Cloud services.
 *
 * @param credentials - The GCP service account credentials containing the private key
 * @returns A Promise that resolves to the imported private key suitable for JWT signing
 *
 * @throws {Error} If the private key format is invalid or cannot be imported
 *
 * @example
 * ```typescript
 * const credentials = normalizeGCPCredentials(credentialsJson);
 * const privateKey = await getGCPPrivateKey(credentials);
 * // Use privateKey for signing operations
 * ```
 */
export function getGCPPrivateKey(credentials: GCPCredentials) {
  return importPKCS8(credentials.private_key, "RS256");
}

/**
 * Generates a custom JWT token for authenticating with Google Cloud services.
 *
 * This function creates a signed JWT (JSON Web Token) using the service account's
 * private key. The token includes standard claims such as issuer, audience, subject,
 * issued-at time, and expiration time. This custom token can be exchanged for an
 * access token or ID token through Google's OAuth2 token endpoint.
 *
 * The generated JWT is valid for 1 hour and follows the OAuth 2.0 JWT Bearer
 * Token flow as specified by RFC 7523.
 *
 * @param credentials - The GCP service account credentials used to sign the JWT
 * @returns A Promise that resolves to the signed JWT string
 *
 * @throws {Error} If the private key cannot be imported or the JWT cannot be signed
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7523
 * @see https://cloud.google.com/iam/docs/creating-short-lived-service-account-credentials
 *
 * @example
 * ```typescript
 * const credentials = normalizeGCPCredentials(credentialsJson);
 * const customToken = await getGCPCustomToken(credentials);
 * // Use customToken to request an access token
 * ```
 */
export async function getGCPCustomToken(credentials: GCPCredentials) {
  const privateKey = await getGCPPrivateKey(credentials);
  const customToken = await new SignJWT()
    .setIssuer(credentials.client_email)
    .setAudience(credentials.token_uri)
    .setSubject(credentials.client_email)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
  return customToken;
}

/**
 * Retrieves an access token for authenticating with Google Cloud APIs.
 *
 * - Tokens are cached based on the token URI and private key ID
 * - Cache entries are valid for up to 1 hour
 * - Expired tokens trigger automatic refresh
 * - Multiple concurrent requests for the same token are deduplicated
 *
 * The function handles both access tokens and ID tokens, automatically detecting
 * which type is returned by the token endpoint and extracting the appropriate
 * expiration time.
 *
 * @param credentials - The GCP service account credentials used to request the token
 * @returns A Promise that resolves to the access token string
 *
 * @throws {AuthError} If the token request fails (e.g., invalid credentials,
 *                     network error, or API error)
 *
 * @see https://cloud.google.com/iam/docs/creating-short-lived-service-account-credentials
 * @see https://datatracker.ietf.org/doc/html/rfc7523
 *
 * @example
 * ```typescript
 * const credentials = normalizeGCPCredentials(credentialsJson);
 * const accessToken = await getGCPCredentialsAccessToken(credentials);
 *
 * // Use the access token in API requests
 * const response = await fetch('https://api.google.com/...', {
 *   headers: {
 *     'Authorization': `Bearer ${accessToken}`
 *   }
 * });
 * ```
 *
 * @remarks
 * The caching mechanism uses a two-level validation:
 * 1. Cache entry age (must be less than CACHE_MAX_AGE)
 * 2. Token expiration time (must not be expired)
 *
 * This ensures that even if a cache entry is fresh, an expired token
 * will trigger a refresh request.
 */
export async function getGCPCredentialsAccessToken(
  credentials: GCPCredentials
): Promise<string> {
  const tokenUrl = credentials.token_uri;

  const cacheKeyUrl = new URL(tokenUrl);
  cacheKeyUrl.searchParams.set("key", credentials.private_key_id);
  const cacheKey = cacheKeyUrl.toString();

  // Attempt to retrieve the token from the cache
  const cacheValue = cache.get(cacheKey);
  let now = Math.floor(Date.now() / 1000);

  if (cacheValue) {
    if (cacheValue.created > now - CACHE_MAX_AGE) {
      let token = await cacheValue.promise;

      if (token.expires > now) {
        return token.token;
      } else {
        const nextValue = cache.get(cacheKey);

        if (nextValue && nextValue !== cacheValue) {
          token = await nextValue.promise;
          if (token.expires > now) {
            return token.token;
          } else {
            cache.delete(cacheKey);
          }
        }
      }
    } else {
      cache.delete(cacheKey);
    }
  }

  const promise = iife(async () => {
    now = Math.floor(Date.now() / 1000);

    // Request a new token from the Google Cloud API
    const jwt = await getGCPCustomToken(credentials);
    const body = new URLSearchParams();
    body.append("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
    body.append("assertion", jwt);
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      throw await AuthError.fromResponse(res);
    }

    const data = await res.json();

    if ("id_token" in data) {
      const claims = decodeJwt(data.id_token);
      return { token: data.id_token, expires: claims.exp as number };
    }

    const lastModified = res.headers.get("last-modified");
    const expires = lastModified
      ? Math.floor(new Date(lastModified).valueOf() / 1000) + data.expires_in
      : now + data.expires_in;

    return { expires, token: data.access_token };
  });

  cache.set(cacheKey, { created: now, promise });
  return await promise.then((data) => data.token);
}
