/**
 * Which URLs and addresses may be fetched. Mirrors `SSRFPolicy` in the
 * Python `langchain_core`.
 *
 * Cloud metadata endpoints are always blocked, whatever the policy says.
 */
export interface SSRFPolicy {
  /** URL schemes that may be fetched, without the colon. Defaults to `["http", "https"]`. */
  allowedSchemes?: string[];
  /** Block private, shared, reserved, documentation and multicast addresses. Defaults to `true`. */
  blockPrivateIps?: boolean;
  /** Block loopback addresses and localhost names. Defaults to `true`. */
  blockLocalhost?: boolean;
  /** Block Kubernetes service names (`*.svc.cluster.local`). Defaults to `true`. */
  blockK8sInternal?: boolean;
  /**
   * Exact hostnames that skip the address checks, e.g. a model server on the
   * local network. Redirects away from them are still checked.
   */
  allowedHosts?: string[];
}

export type ResolvedSSRFPolicy = Required<SSRFPolicy>;

export function resolvePolicy(policy: SSRFPolicy = {}): ResolvedSSRFPolicy {
  return {
    allowedSchemes: (policy.allowedSchemes ?? ["http", "https"]).map((s) =>
      s.toLowerCase().replace(/:$/, "")
    ),
    blockPrivateIps: policy.blockPrivateIps ?? true,
    blockLocalhost: policy.blockLocalhost ?? true,
    blockK8sInternal: policy.blockK8sInternal ?? true,
    allowedHosts: (policy.allowedHosts ?? []).map(normalizeHostname),
  };
}

type AddressClass = "metadata" | "localhost" | "private";

const METADATA_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.amazonaws.com",
  "metadata",
  "instance-data",
]);

const LOCALHOST_NAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "host.docker.internal",
]);

// First match wins, so the metadata ranges come before the wider ones.
const IPV4_RANGE_SPECS: [string, number, AddressClass][] = [
  ["169.254.0.0", 16, "metadata"],
  ["100.100.100.200", 32, "metadata"],
  ["127.0.0.0", 8, "localhost"],
  ["0.0.0.0", 8, "localhost"],
  ["10.0.0.0", 8, "private"],
  ["172.16.0.0", 12, "private"],
  ["192.168.0.0", 16, "private"],
  ["100.64.0.0", 10, "private"],
  ["192.0.0.0", 24, "private"],
  ["192.0.2.0", 24, "private"],
  ["198.18.0.0", 15, "private"],
  ["198.51.100.0", 24, "private"],
  ["203.0.113.0", 24, "private"],
  ["224.0.0.0", 4, "private"],
  ["240.0.0.0", 4, "private"],
];

const IPV6_METADATA = new Set([
  "fd00:ec2:0:0:0:0:0:254",
  "fd00:ec2:0:0:0:0:0:23",
  "fe80:0:0:0:0:0:a9fe:a9fe",
]);

const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

/** Lowercase, drop IPv6 brackets and a trailing dot. */
export function normalizeHostname(hostname: string): string {
  let host = hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  return host.endsWith(".") ? host.slice(0, -1) : host;
}

function parseIPv4(ip: string): number | null {
  if (!IPV4_REGEX.test(ip)) return null;
  return ip
    .split(".")
    .reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
}

/** Parse an IPv6 address (dotted IPv4 tail allowed) into eight 16-bit groups. */
function parseIPv6(ip: string): number[] | null {
  if (!ip.includes(":")) return null;
  let text = ip;
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (v4 === null) return null;
    text = `${text.slice(0, lastColon + 1)}${(v4 >>> 16).toString(16)}:${(
      v4 & 0xffff
    ).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const parts = [...head, ...Array(missing).fill("0"), ...rest];
  if (!parts.every((p) => /^[0-9a-f]{1,4}$/i.test(p))) return null;
  return parts.map((p) => parseInt(p, 16));
}

/** Whether `ip` is an IPv4 or IPv6 address literal (no brackets). */
export function isIpLiteral(ip: string): boolean {
  return parseIPv4(ip) !== null || parseIPv6(ip) !== null;
}

const IPV4_RANGES = IPV4_RANGE_SPECS.map(
  ([base, prefix, cls]) => [parseIPv4(base) as number, prefix, cls] as const
);

function classifyIPv4(n: number): AddressClass | null {
  for (const [base, prefix, cls] of IPV4_RANGES) {
    if ((n ^ base) >>> (32 - prefix) === 0) return cls;
  }
  return null;
}

function classifyIPv6(g: number[]): AddressClass | null {
  const zeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  const embedded = ((g[6] << 16) | g[7]) >>> 0;
  if (zeroUpTo(7) && (g[7] === 0 || g[7] === 1)) return "localhost";
  if (IPV6_METADATA.has(g.map((x) => x.toString(16)).join(":"))) {
    return "metadata";
  }
  // ::ffff:a.b.c.d (IPv4-mapped)
  if (zeroUpTo(5) && g[5] === 0xffff) return classifyIPv4(embedded);
  // ::a.b.c.d (IPv4-compatible, deprecated)
  if (zeroUpTo(6)) return "private";
  // 64:ff9b::/96 (NAT64)
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => !x)) {
    return classifyIPv4(embedded);
  }
  // 64:ff9b:1::/48 (local-use NAT64)
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return "private";
  // 2002::/16 (6to4) carries the IPv4 address in the next 32 bits
  if (g[0] === 0x2002) return classifyIPv4(((g[1] << 16) | g[2]) >>> 0);
  // 2001::/32 (Teredo) carries the client IPv4 address inverted
  if (g[0] === 0x2001 && g[1] === 0) return classifyIPv4(~embedded >>> 0);
  // 2001:db8::/32 (documentation)
  if (g[0] === 0x2001 && g[1] === 0xdb8) return "private";
  // fc00::/7 unique local, fe80::/10 link-local, fec0::/10 site-local, ff00::/8 multicast
  if ((g[0] & 0xfe00) === 0xfc00) return "private";
  if ((g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xffc0) === 0xfec0) {
    return "private";
  }
  if ((g[0] & 0xff00) === 0xff00) return "private";
  return null;
}

/**
 * Classify an address literal. Returns `null` for a public address and
 * `undefined` for something that isn't an address.
 */
export function classifyAddress(ip: string): AddressClass | null | undefined {
  const host = normalizeHostname(ip);
  const v4 = parseIPv4(host);
  if (v4 !== null) return classifyIPv4(v4);
  const v6 = parseIPv6(host);
  if (v6 !== null) return classifyIPv6(v6);
  return undefined;
}

/**
 * Why `ip` (an address a hostname resolved to, or a literal in a URL) may not
 * be connected to, or `undefined` if it may. Anything that doesn't parse as
 * an address is refused.
 */
export function addressBlockReason(
  ip: string,
  policy: ResolvedSSRFPolicy
): string | undefined {
  const cls = classifyAddress(ip);
  if (cls === undefined) return `not an IP address: ${ip}`;
  if (cls === "metadata") return `cloud metadata IP: ${ip}`;
  if (cls === "localhost" && policy.blockLocalhost) return `localhost: ${ip}`;
  if (cls === "private" && policy.blockPrivateIps) return `private IP: ${ip}`;
  return undefined;
}

export function isMetadataHostname(hostname: string): boolean {
  return METADATA_HOSTNAMES.has(normalizeHostname(hostname));
}

export function isLocalhostName(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return LOCALHOST_NAMES.has(host) || host.endsWith(".localhost");
}

export function isAllowedHost(
  hostname: string,
  policy: ResolvedSSRFPolicy
): boolean {
  return policy.allowedHosts.includes(normalizeHostname(hostname));
}

/**
 * Check a URL against a policy without resolving DNS: the scheme, the
 * hostname, and the address when the host is an IP literal.
 *
 * @throws Error if the URL may not be fetched.
 */
export function checkUrl(url: string | URL, policy: ResolvedSSRFPolicy): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  const scheme = parsed.protocol.slice(0, -1);
  if (!policy.allowedSchemes.includes(scheme)) {
    if (scheme === "http" && policy.allowedSchemes.includes("https")) {
      throw new Error(
        "HTTP scheme not allowed. Use HTTPS or set allowHttp: true."
      );
    }
    throw new Error(
      `Invalid URL scheme: ${scheme}. Allowed: ${policy.allowedSchemes.join(", ")}.`
    );
  }
  const host = normalizeHostname(parsed.hostname);
  if (!host) throw new Error("URL missing hostname.");
  if (isMetadataHostname(host)) {
    throw new Error(`URL points to cloud metadata endpoint: ${host}`);
  }
  const literal = isIpLiteral(host);
  if (isAllowedHost(host, policy)) {
    if (literal && classifyAddress(host) === "metadata") {
      throw new Error(`URL points to cloud metadata IP: ${host}`);
    }
    return parsed;
  }
  if (literal) {
    const reason = addressBlockReason(host, policy);
    if (reason) throw new Error(`URL points to ${reason}`);
    return parsed;
  }
  if (policy.blockLocalhost && isLocalhostName(host)) {
    throw new Error(`URL points to localhost: ${host}`);
  }
  if (policy.blockK8sInternal && host.endsWith(".svc.cluster.local")) {
    throw new Error(`URL points to a Kubernetes service: ${host}`);
  }
  return parsed;
}
