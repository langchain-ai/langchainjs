import {
  checkUrl,
  classifyAddress,
  isAllowedHost,
  isIpLiteral,
  isLocalhostName,
  isMetadataHostname,
  normalizeHostname,
  resolvePolicy,
  type ResolvedSSRFPolicy,
  type SSRFPolicy,
} from "./ssrf/policy.js";
import {
  createBunResolver,
  createNodeResolver,
  getBun,
  getNodeBuiltins,
  isNodeRuntime,
  resolveChecked,
} from "./ssrf/runtime.js";

export type { SSRFPolicy } from "./ssrf/policy.js";
export {
  createSafeFetch,
  type SafeFetch,
  type SafeFetchOptions,
} from "./ssrf/fetch.js";

/**
 * Options for {@link validateSafeUrl}. `allowPrivate` and `allowHttp` are
 * shorthands: `allowPrivate` turns off `blockPrivateIps` and
 * `blockLocalhost`, and without `allowHttp` or `allowedSchemes` only https is
 * allowed.
 */
export type SafeUrlOptions = SSRFPolicy & {
  /** Allow private and localhost addresses (default: false). */
  allowPrivate?: boolean;
  /** Allow the http:// scheme (default: false). */
  allowHttp?: boolean;
};

function policyFromOptions(options: SafeUrlOptions = {}): ResolvedSSRFPolicy {
  const { allowPrivate, allowHttp, ...policy } = options;
  return resolvePolicy({
    ...policy,
    allowedSchemes:
      policy.allowedSchemes ?? (allowHttp ? ["http", "https"] : ["https"]),
    blockPrivateIps: policy.blockPrivateIps ?? !allowPrivate,
    blockLocalhost: policy.blockLocalhost ?? !allowPrivate,
  });
}

/**
 * Check if an IP address is not publicly routable: private, loopback,
 * link-local, shared, reserved, documentation or multicast. IPv4 addresses
 * embedded in IPv6 (mapped, NAT64, 6to4, Teredo) are judged as IPv4.
 */
export function isPrivateIp(ip: string): boolean {
  const cls = classifyAddress(ip);
  return cls !== null && cls !== undefined;
}

/**
 * Check if a hostname or IP is a known cloud metadata endpoint.
 */
export function isCloudMetadata(hostname: string, ip?: string): boolean {
  return (
    isMetadataHostname(hostname) ||
    (ip !== undefined && classifyAddress(ip) === "metadata")
  );
}

/**
 * Check if a hostname or IP is localhost.
 */
export function isLocalhost(hostname: string, ip?: string): boolean {
  return (
    isLocalhostName(hostname) ||
    (ip !== undefined && classifyAddress(ip) === "localhost")
  );
}

/**
 * Validate that a URL is safe to connect to, without resolving DNS: the
 * scheme, the hostname, and the address when the host is an IP literal.
 *
 * A hostname that resolves to a private address passes this check. To fetch
 * URLs from untrusted input, use {@link createSafeFetch}, which checks the
 * address it actually connects to.
 *
 * @param url URL to validate
 * @param options Policy, or the `allowPrivate` / `allowHttp` shorthands
 * @returns The validated URL
 * @throws Error if URL is not safe
 */
export function validateSafeUrl(url: string, options?: SafeUrlOptions): string {
  checkUrl(url, policyFromOptions(options));
  return url;
}

/**
 * Check if a URL is safe to connect to (non-throwing version of
 * {@link validateSafeUrl}).
 */
export function isSafeUrl(url: string, options?: SafeUrlOptions): boolean {
  try {
    validateSafeUrl(url, options);
    return true;
  } catch {
    return false;
  }
}

/**
 * {@link validateSafeUrl}, plus resolving the hostname and checking every
 * address it resolves to. Use it to check a URL when it's configured, such as
 * a base URL; it can't stop the name resolving elsewhere later. The requests
 * themselves should go through {@link createSafeFetch}, which connects to the
 * address it checked.
 *
 * Where DNS isn't available (browsers, Deno, Cloudflare Workers, edge), only
 * the static checks run.
 *
 * @throws Error if the URL or any resolved address is not allowed
 */
export async function validateSafeUrlAsync(
  url: string,
  options?: SafeUrlOptions
): Promise<string> {
  const policy = policyFromOptions(options);
  const host = normalizeHostname(checkUrl(url, policy).hostname);
  const bun = getBun();
  const resolve = isNodeRuntime()
    ? createNodeResolver(getNodeBuiltins().dns)
    : bun && createBunResolver(bun);
  if (resolve && !isIpLiteral(host) && !isAllowedHost(host, policy)) {
    await resolveChecked(resolve, host, policy);
  }
  return url;
}

/**
 * Check if two URLs have the same origin (scheme, host, port).
 * Uses semantic URL parsing to prevent SSRF bypasses via URL variations.
 *
 * @param url1 First URL
 * @param url2 Second URL
 * @returns true if both URLs have the same origin, false otherwise
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    return new URL(url1).origin === new URL(url2).origin;
  } catch {
    return false;
  }
}
