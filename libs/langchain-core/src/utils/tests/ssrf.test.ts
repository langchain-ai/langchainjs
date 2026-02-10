import { describe, test, expect } from "vitest";
import {
  isPrivateIp,
  isCloudMetadata,
  isLocalhost,
  validateSafeUrl,
  isSafeUrl,
  isSameOrigin,
} from "../ssrf.js";

describe("isPrivateIp", () => {
  // RFC 1918 private ranges
  test("should identify 10.x.x.x as private", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("10.255.255.255")).toBe(true);
    expect(isPrivateIp("10.128.0.0")).toBe(true);
  });

  test("should identify 172.16.x.x-172.31.x.x as private", () => {
    expect(isPrivateIp("172.16.0.0")).toBe(true);
    expect(isPrivateIp("172.16.255.255")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("172.20.0.1")).toBe(true);
  });

  test("should identify 192.168.x.x as private", () => {
    expect(isPrivateIp("192.168.0.0")).toBe(true);
    expect(isPrivateIp("192.168.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  test("should identify loopback range 127.x.x.x as private", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("127.255.255.255")).toBe(true);
    expect(isPrivateIp("127.0.0.0")).toBe(true);
  });

  test("should identify link-local range 169.254.x.x as private", () => {
    expect(isPrivateIp("169.254.0.0")).toBe(true);
    expect(isPrivateIp("169.254.255.255")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
  });

  test("should identify 0.0.0.x as private", () => {
    expect(isPrivateIp("0.0.0.1")).toBe(true);
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("0.255.255.255")).toBe(true);
  });

  test("should identify public IPs as not private", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("208.67.222.222")).toBe(false);
  });

  test("should handle IPv6 private addresses", () => {
    expect(isPrivateIp("::1")).toBe(true); // loopback
    expect(isPrivateIp("fc00::1")).toBe(true); // Unique Local Address
    expect(isPrivateIp("fe80::1")).toBe(true); // Link-local
    expect(isPrivateIp("ff00::1")).toBe(true); // Multicast
  });

  test("should handle IPv6 public addresses", () => {
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false); // Google Public DNS
  });

  test("should reject invalid IPs", () => {
    expect(isPrivateIp("invalid")).toBe(false);
    expect(isPrivateIp("256.256.256.256")).toBe(false);
    expect(isPrivateIp("")).toBe(false);
  });
});

describe("isCloudMetadata", () => {
  test("should identify known metadata IPs", () => {
    expect(isCloudMetadata("example.com", "169.254.169.254")).toBe(true);
    expect(isCloudMetadata("example.com", "169.254.170.2")).toBe(true);
    expect(isCloudMetadata("example.com", "100.100.100.200")).toBe(true);
  });

  test("should identify known metadata hostnames", () => {
    expect(isCloudMetadata("metadata.google.internal")).toBe(true);
    expect(isCloudMetadata("metadata")).toBe(true);
    expect(isCloudMetadata("instance-data")).toBe(true);
  });

  test("should be case-insensitive for hostnames", () => {
    expect(isCloudMetadata("METADATA")).toBe(true);
    expect(isCloudMetadata("Metadata.Google.Internal")).toBe(true);
    expect(isCloudMetadata("INSTANCE-DATA")).toBe(true);
  });

  test("should reject normal hostnames", () => {
    expect(isCloudMetadata("example.com")).toBe(false);
    expect(isCloudMetadata("google.com")).toBe(false);
    expect(isCloudMetadata("localhost")).toBe(false);
  });

  test("should reject normal IPs", () => {
    expect(isCloudMetadata("example.com", "8.8.8.8")).toBe(false);
    expect(isCloudMetadata("example.com", "1.1.1.1")).toBe(false);
  });
});

describe("isLocalhost", () => {
  test("should identify localhost hostname", () => {
    expect(isLocalhost("localhost")).toBe(true);
    expect(isLocalhost("localhost.localdomain")).toBe(true);
  });

  test("should be case-insensitive", () => {
    expect(isLocalhost("LOCALHOST")).toBe(true);
    expect(isLocalhost("LocalHost")).toBe(true);
  });

  test("should identify localhost IPs", () => {
    expect(isLocalhost("example.com", "127.0.0.1")).toBe(true);
    expect(isLocalhost("example.com", "::1")).toBe(true);
    expect(isLocalhost("example.com", "0.0.0.0")).toBe(true);
  });

  test("should reject normal hostnames", () => {
    expect(isLocalhost("example.com")).toBe(false);
    expect(isLocalhost("google.com")).toBe(false);
  });

  test("should reject normal IPs", () => {
    expect(isLocalhost("example.com", "8.8.8.8")).toBe(false);
    expect(isLocalhost("example.com", "192.168.1.1")).toBe(false);
  });
});

describe("validateSafeUrl", () => {
  test("should accept valid public HTTPS URLs", async () => {
    const result = await validateSafeUrl("https://example.com/path");
    expect(result).toBe("https://example.com/path");
  });

  test("should reject localhost by default", async () => {
    await expect(
      validateSafeUrl("https://localhost:8000/path")
    ).rejects.toThrow(/localhost/);
  });

  test("should allow localhost with allowPrivate flag", async () => {
    const result = await validateSafeUrl("https://localhost:8000/path", {
      allowPrivate: true,
    });
    expect(result).toBe("https://localhost:8000/path");
  });

  test("should reject HTTP by default", async () => {
    // Using a public domain to focus on scheme check
    await expect(
      validateSafeUrl("http://example.com/path")
    ).rejects.toThrow(/HTTP scheme not allowed/);
  });

  test("should allow HTTP with allowHttp flag", async () => {
    const result = await validateSafeUrl("http://example.com/path", {
      allowHttp: true,
    });
    expect(result).toBe("http://example.com/path");
  });

  test("should reject invalid URL schemes", async () => {
    await expect(validateSafeUrl("ftp://example.com")).rejects.toThrow();
    await expect(validateSafeUrl("file:///etc/passwd")).rejects.toThrow();
    await expect(validateSafeUrl("javascript:alert(1)")).rejects.toThrow();
  });

  test("should reject URLs with missing hostname", async () => {
    await expect(validateSafeUrl("https://")).rejects.toThrow(
      /invalid|missing hostname/i
    );
  });

  test("should reject cloud metadata endpoints", async () => {
    // Direct metadata hostnames
    await expect(
      validateSafeUrl("https://metadata")
    ).rejects.toThrow(/metadata/);

    await expect(
      validateSafeUrl("https://instance-data")
    ).rejects.toThrow(/instance-data/);
  });

  test("should reject private IPs by default", async () => {
    await expect(
      validateSafeUrl("https://192.168.1.1")
    ).rejects.toThrow(/private|allowPrivate/i);

    await expect(
      validateSafeUrl("https://10.0.0.1")
    ).rejects.toThrow(/private|allowPrivate/i);
  });

  test("should allow private IPs with allowPrivate flag", async () => {
    const result = await validateSafeUrl("https://192.168.1.1", {
      allowPrivate: true,
    });
    expect(result).toBe("https://192.168.1.1");
  });

  test("should handle 127.0.0.1 as localhost", async () => {
    await expect(
      validateSafeUrl("https://127.0.0.1")
    ).rejects.toThrow(/localhost/i);

    const result = await validateSafeUrl("https://127.0.0.1", {
      allowPrivate: true,
    });
    expect(result).toBe("https://127.0.0.1");
  });
});

describe("isSafeUrl", () => {
  test("should return true for safe URLs", async () => {
    const result = await isSafeUrl("https://example.com");
    expect(result).toBe(true);
  });

  test("should return false for localhost by default", async () => {
    const result = await isSafeUrl("https://localhost");
    expect(result).toBe(false);
  });

  test("should return true for localhost with allowPrivate", async () => {
    const result = await isSafeUrl("https://localhost", {
      allowPrivate: true,
    });
    expect(result).toBe(true);
  });

  test("should return false for invalid schemes", async () => {
    const result = await isSafeUrl("ftp://example.com");
    expect(result).toBe(false);
  });

  test("should return false for HTTP by default", async () => {
    const result = await isSafeUrl("http://example.com");
    expect(result).toBe(false);
  });

  test("should return true for HTTP with allowHttp", async () => {
    const result = await isSafeUrl("http://example.com", { allowHttp: true });
    expect(result).toBe(true);
  });

  test("should handle DNS resolution failures gracefully", async () => {
    const result = await isSafeUrl("https://nonexistent-domain-12345.test");
    expect(result).toBe(false);
  });
});

describe("isSameOrigin", () => {
  test("should return true for identical URLs", () => {
    expect(isSameOrigin("https://example.com", "https://example.com")).toBe(
      true
    );
    expect(
      isSameOrigin("https://example.com/path", "https://example.com/other")
    ).toBe(true);
  });

  test("should return true for URLs with same scheme, host, and port", () => {
    expect(isSameOrigin("https://example.com:443", "https://example.com")).toBe(
      true
    );
    expect(isSameOrigin("http://example.com:80", "http://example.com")).toBe(
      true
    );
    expect(isSameOrigin("https://example.com:8443", "https://example.com:8443")).toBe(
      true
    );
  });

  test("should return false for different schemes", () => {
    expect(isSameOrigin("http://example.com", "https://example.com")).toBe(
      false
    );
  });

  test("should return false for different hosts", () => {
    expect(
      isSameOrigin("https://example.com", "https://other.com")
    ).toBe(false);
    expect(
      isSameOrigin("https://example.com", "https://subdomain.example.com")
    ).toBe(false);
  });

  test("should return false for different ports", () => {
    expect(
      isSameOrigin("https://example.com:443", "https://example.com:8443")
    ).toBe(false);
    expect(isSameOrigin("http://example.com:8080", "http://example.com:9090")).toBe(
      false
    );
  });

  test("should return false for invalid URLs", () => {
    expect(isSameOrigin("invalid", "https://example.com")).toBe(false);
    expect(isSameOrigin("https://example.com", "not-a-url")).toBe(false);
    expect(isSameOrigin("", "")).toBe(false);
  });

  test("should handle subdomain as different origin", () => {
    expect(
      isSameOrigin("https://sub.example.com", "https://example.com")
    ).toBe(false);
    expect(
      isSameOrigin("https://www.example.com", "https://api.example.com")
    ).toBe(false);
  });

  test("should be case-insensitive for hosts", () => {
    expect(
      isSameOrigin("https://Example.com", "https://example.com")
    ).toBe(true);
    expect(
      isSameOrigin("HTTPS://EXAMPLE.COM", "https://example.com")
    ).toBe(true);
  });
});

describe("Real-world URLs", () => {
  test("should allow valid webhook URLs", async () => {
    const result = await isSafeUrl("https://webhook.site/unique-id");
    expect(result).toBe(true);
  });

  test("should handle HTTPS external APIs", async () => {
    // Changed to use example.com which is known to be safe
    // api.example.com may not exist and cause DNS resolution failure
    const result = await isSafeUrl("https://www.google.com");
    expect(result).toBe(true);
  });

  test("should reject localhost callbacks by default", async () => {
    const result = await isSafeUrl("https://localhost:3000/callback");
    expect(result).toBe(false);
  });

  test("should allow localhost callbacks with flag", async () => {
    const result = await isSafeUrl("https://localhost:3000/callback", {
      allowPrivate: true,
    });
    expect(result).toBe(true);
  });
});
