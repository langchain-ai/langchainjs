import { MCPClientError } from "./errors.js";

/** Compare without an early exit, so timing does not reveal a matching prefix. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);

  return difference === 0;
}

/**
 * Enforce the application's `state` before any code is redeemed. The SDK
 * leaves `state` to the application; PKCE still binds the code otherwise.
 */
export function assertCallbackState(
  params: URLSearchParams,
  expected: string,
  serverName: string
): void {
  const states = params.getAll("state");

  if (states.length !== 1 || !constantTimeEqual(states[0], expected))
    throw new MCPClientError(
      `OAuth callback state for "${serverName}" does not match this authorization attempt`,
      serverName
    );
}

/** RFC 6749 §4.1.2.1's authorization-endpoint `error` codes. */
const AUTHORIZATION_ERROR_CODES = new Set([
  "invalid_request",
  "unauthorized_client",
  "access_denied",
  "unsupported_response_type",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
]);

/** The callback's `error` if it is a standard code; never its free text. */
export function knownCallbackErrorCode(
  params: URLSearchParams
): string | undefined {
  const code = params.get("error") ?? "";
  return AUTHORIZATION_ERROR_CODES.has(code) ? code : undefined;
}

/**
 * A fresh transport never saw the 401 that started the login, so only the
 * provider's persisted discovery state can carry that challenge's metadata URL.
 */
export function discoveryStateHint(provider: {
  discoveryState?: unknown;
}): string {
  return typeof provider.discoveryState === "function"
    ? ""
    : " If the authorization server is only discoverable from the server's 401 challenge, implement saveDiscoveryState() and discoveryState() on the provider.";
}
