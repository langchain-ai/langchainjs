import { resolve4, resolve6 } from "dns/promises";
import * as net from "net";

// Private IP ranges (RFC 1918, loopback, link-local, etc.)
const PRIVATE_IP_RANGES = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "0.0.0.0/8",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
  "ff00::/8",
];

// Cloud metadata IPs
const CLOUD_METADATA_IPS = ["169.254.169.254", "169.254.170.2", "100.100.100.200"];

// Cloud metadata hostnames (case-insensitive)
const CLOUD_METADATA_HOSTNAMES = [
  "metadata.google.internal",
  "metadata",
  "instance-data",
];

// Localhost variations
const LOCALHOST_NAMES = ["localhost", "localhost.localdomain"];

/**
 * Parse an IP address string to an array of integers (for IPv4) or an array of 16-bit values (for IPv6)
 * Returns null if the IP is invalid.
 */
function parseIp(ip: string): number[] | null {
  if (net.isIPv4(ip)) {
    return ip.split(".").map((octet) => parseInt(octet, 10));
  } else if (net.isIPv6(ip)) {
    // Normalize IPv6
    const expanded = expandIpv6(ip);
    if (!expanded) return null;
    const parts = expanded.split(":");
    const result: number[] = [];
    for (const part of parts) {
      result.push(parseInt(part, 16));
    }
    return result;
  }
  return null;
}

/**
 * Expand compressed IPv6 address to full form.
 */
function expandIpv6(ip: string): string | null {
  // Use Node's built-in IPv6 validation by parsing
  const socket = new net.Socket();
  try {
    if (!net.isIPv6(ip)) {
      return null;
    }

    // Simple expansion logic for IPv6
    let normalized = ip;

    // Handle :: compression
    if (normalized.includes("::")) {
      const parts = normalized.split("::");
      if (parts.length > 2) {
        return null; // Invalid: multiple ::
      }

      const [left, right] = parts;
      const leftParts = left ? left.split(":") : [];
      const rightParts = right ? right.split(":") : [];
      const missing = 8 - (leftParts.length + rightParts.length);

      if (missing < 0) {
        return null;
      }

      const zeros = Array(missing).fill("0");
      normalized = [
        ...leftParts,
        ...zeros,
        ...rightParts,
      ]
        .filter((p) => p !== "")
        .join(":");
    }

    // Pad missing zeros
    const parts = normalized.split(":");
    if (parts.length !== 8) {
      return null;
    }

    return parts
      .map((p) => p.padStart(4, "0").toLowerCase())
      .join(":");
  } finally {
    socket.destroy();
  }
}

/**
 * Parse CIDR notation (e.g., "192.168.0.0/24") into network address and prefix length.
 */
function parseCidr(
  cidr: string
): { addr: number[]; prefixLen: number; isIpv6: boolean } | null {
  const [addrStr, prefixStr] = cidr.split("/");
  if (!addrStr || !prefixStr) {
    return null;
  }

  const addr = parseIp(addrStr);
  if (!addr) {
    return null;
  }

  const prefixLen = parseInt(prefixStr, 10);
  if (isNaN(prefixLen)) {
    return null;
  }

  const isIpv6 = net.isIPv6(addrStr);

  if (isIpv6 && prefixLen > 128) {
    return null;
  }
  if (!isIpv6 && prefixLen > 32) {
    return null;
  }

  return { addr, prefixLen, isIpv6 };
}

/**
 * Check if an IP address is in a given CIDR range.
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  const ipParsed = parseIp(ip);
  if (!ipParsed) {
    return false;
  }

  const cidrParsed = parseCidr(cidr);
  if (!cidrParsed) {
    return false;
  }

  // Check IPv4 vs IPv6 mismatch
  const isIpv6 = net.isIPv6(ip);
  if (isIpv6 !== cidrParsed.isIpv6) {
    return false;
  }

  const { addr: cidrAddr, prefixLen } = cidrParsed;

  // Convert to bits and compare
  if (isIpv6) {
    // IPv6: each element is 16 bits
    for (let i = 0; i < Math.ceil(prefixLen / 16); i++) {
      const bitsToCheck = Math.min(16, prefixLen - i * 16);
      const mask = (0xffff << (16 - bitsToCheck)) & 0xffff;
      if ((ipParsed[i] & mask) !== (cidrAddr[i] & mask)) {
        return false;
      }
    }
  } else {
    // IPv4: each element is 8 bits
    for (let i = 0; i < Math.ceil(prefixLen / 8); i++) {
      const bitsToCheck = Math.min(8, prefixLen - i * 8);
      const mask = (0xff << (8 - bitsToCheck)) & 0xff;
      if ((ipParsed[i] & mask) !== (cidrAddr[i] & mask)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if an IP address is private (RFC 1918, loopback, link-local, etc.)
 */
export function isPrivateIp(ip: string): boolean {
  // Validate it's a proper IP
  if (!net.isIP(ip)) {
    return false;
  }

  for (const range of PRIVATE_IP_RANGES) {
    if (isIpInCidr(ip, range)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a hostname or IP is a known cloud metadata endpoint.
 */
export function isCloudMetadata(hostname: string, ip?: string): boolean {
  // Check if it's a known metadata IP
  if (CLOUD_METADATA_IPS.includes(ip || "")) {
    return true;
  }

  // Check if hostname matches (case-insensitive)
  const lowerHostname = hostname.toLowerCase();
  if (CLOUD_METADATA_HOSTNAMES.includes(lowerHostname)) {
    return true;
  }

  return false;
}

/**
 * Check if a hostname or IP is localhost.
 */
export function isLocalhost(hostname: string, ip?: string): boolean {
  // Check if it's a localhost IP
  if (ip) {
    // Check for typical localhost IPs (loopback range)
    if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") {
      return true;
    }
    // Check if IP starts with 127. (entire loopback range)
    if (ip.startsWith("127.")) {
      return true;
    }
  }

  // Check if hostname is localhost
  const lowerHostname = hostname.toLowerCase();
  if (LOCALHOST_NAMES.includes(lowerHostname)) {
    return true;
  }

  return false;
}

/**
 * Validate that a URL is safe to connect to.
 * Resolves the hostname to IP(s) and checks against private/metadata ranges.
 *
 * @param url URL to validate
 * @param options.allowPrivate Allow private IPs (default: false)
 * @param options.allowHttp Allow http:// scheme (default: false)
 * @returns The validated URL
 * @throws Error if URL is not safe
 */
export async function validateSafeUrl(
  url: string,
  options?: { allowPrivate?: boolean; allowHttp?: boolean }
): Promise<string> {
  const allowPrivate = options?.allowPrivate ?? false;
  const allowHttp = options?.allowHttp ?? false;

  try {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    const hostname = parsedUrl.hostname;
    if (!hostname) {
      throw new Error("URL missing hostname.");
    }

    // Check if it's a cloud metadata endpoint (always blocked)
    if (isCloudMetadata(hostname)) {
      throw new Error(`URL points to cloud metadata endpoint: ${hostname}`);
    }

    // Check if it's localhost (blocked unless allowPrivate is true)
    if (isLocalhost(hostname)) {
      if (!allowPrivate) {
        throw new Error(`URL points to localhost: ${hostname}`);
      }
      return url;
    }

    // Check scheme (after localhost checks to give better error messages)
    const scheme = parsedUrl.protocol;
    if (scheme !== "http:" && scheme !== "https:") {
      throw new Error(
        `Invalid URL scheme: ${scheme}. Only http and https are allowed.`
      );
    }

    if (scheme === "http:" && !allowHttp) {
      throw new Error(
        "HTTP scheme not allowed. Use HTTPS or set allowHttp: true."
      );
    }

    // If hostname is already an IP, validate it directly
    if (net.isIP(hostname)) {
      const ip = hostname;

      // Check if it's localhost first (before private IP check)
      if (isLocalhost(hostname, ip)) {
        if (!allowPrivate) {
          throw new Error(`URL points to localhost: ${hostname}`);
        }
        return url;
      }

      // Cloud metadata is always blocked
      if (isCloudMetadata(hostname, ip)) {
        throw new Error(
          `URL resolves to cloud metadata IP: ${ip} (${hostname})`
        );
      }

      // Check private IPs
      if (isPrivateIp(ip)) {
        if (!allowPrivate) {
          throw new Error(
            `URL resolves to private IP: ${ip} (${hostname}). Set allowPrivate: true to allow.`
          );
        }
      }

      return url;
    }

    // Try to resolve the hostname
    let ips: string[] = [];
    try {
      // Try IPv4 first
      ips = await resolve4(hostname);
    } catch {
      try {
        // Fall back to IPv6
        ips = await resolve6(hostname);
      } catch {
        // If DNS resolution fails, fail closed
        throw new Error(`Failed to resolve hostname: ${hostname}`);
      }
    }

    if (ips.length === 0) {
      throw new Error(`Failed to resolve hostname: ${hostname}`);
    }

    // Check each IP
    for (const ip of ips) {
      // Cloud metadata is always blocked
      if (isCloudMetadata(hostname, ip)) {
        throw new Error(
          `URL resolves to cloud metadata IP: ${ip} (${hostname})`
        );
      }

      // Check private IPs
      if (isPrivateIp(ip)) {
        if (!allowPrivate) {
          throw new Error(
            `URL resolves to private IP: ${ip} (${hostname}). Set allowPrivate: true to allow.`
          );
        }
      }
    }

    return url;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw new Error(`URL validation failed: ${error}`);
  }
}

/**
 * Check if a URL is safe to connect to (non-throwing version).
 *
 * @param url URL to check
 * @param options.allowPrivate Allow private IPs (default: false)
 * @param options.allowHttp Allow http:// scheme (default: false)
 * @returns true if URL is safe, false otherwise
 */
export async function isSafeUrl(
  url: string,
  options?: { allowPrivate?: boolean; allowHttp?: boolean }
): Promise<boolean> {
  try {
    await validateSafeUrl(url, options);
    return true;
  } catch {
    return false;
  }
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
