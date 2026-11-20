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
  test("should accept valid public HTTPS URLs", () => {
    const result = validateSafeUrl("https://example.com/path");
    expect(result).toBe("https://example.com/path");
  });

  test("should reject localhost by default", () => {
    expect(() => validateSafeUrl("https://localhost:8000/path")).toThrow(
      /localhost/
    );
  });

  test("should allow localhost with allowPrivate flag", () => {
    const result = validateSafeUrl("https://localhost:8000/path", {
      allowPrivate: true,
    });
    expect(result).toBe("https://localhost:8000/path");
  });

  test("should reject HTTP by default", () => {
    // Using a public domain to focus on scheme check
    expect(() => validateSafeUrl("http://example.com/path")).toThrow(
      /HTTP scheme not allowed/
    );
  });

  test("should allow HTTP with allowHttp flag", () => {
    const result = validateSafeUrl("http://example.com/path", {
      allowHttp: true,
    });
    expect(result).toBe("http://example.com/path");
  });

  test("should reject invalid URL schemes", () => {
    expect(() => validateSafeUrl("ftp://example.com")).toThrow();
    expect(() => validateSafeUrl("file:///etc/passwd")).toThrow();
    expect(() => validateSafeUrl("javascript:alert(1)")).toThrow();
  });

  test("should reject URLs with missing hostname", () => {
    expect(() => validateSafeUrl("https://")).toThrow(
      /invalid|missing hostname/i
    );
  });

  test("should reject cloud metadata endpoints", () => {
    // Direct metadata hostnames
    expect(() => validateSafeUrl("https://metadata")).toThrow(/metadata/);

    expect(() => validateSafeUrl("https://instance-data")).toThrow(
      /instance-data/
    );
  });

  test("should reject private IPs by default", () => {
    expect(() => validateSafeUrl("https://192.168.1.1")).toThrow(
      /private|allowPrivate/i
    );

    expect(() => validateSafeUrl("https://10.0.0.1")).toThrow(
      /private|allowPrivate/i
    );
  });

  test("should allow private IPs with allowPrivate flag", () => {
    const result = validateSafeUrl("https://192.168.1.1", {
      allowPrivate: true,
    });
    expect(result).toBe("https://192.168.1.1");
  });

  test("should handle 127.0.0.1 as localhost", () => {
    expect(() => validateSafeUrl("https://127.0.0.1")).toThrow(/localhost/i);

    const result = validateSafeUrl("https://127.0.0.1", {
      allowPrivate: true,
    });
    expect(result).toBe("https://127.0.0.1");
  });
});

describe("isSafeUrl", () => {
  test("should return true for safe URLs", () => {
    const result = isSafeUrl("https://example.com");
    expect(result).toBe(true);
  });

  test("should return false for localhost by default", () => {
    const result = isSafeUrl("https://localhost");
    expect(result).toBe(false);
  });

  test("should return true for localhost with allowPrivate", () => {
    const result = isSafeUrl("https://localhost", {
      allowPrivate: true,
    });
    expect(result).toBe(true);
  });

  test("should return false for invalid schemes", () => {
    const result = isSafeUrl("ftp://example.com");
    expect(result).toBe(false);
  });

  test("should return false for HTTP by default", () => {
    const result = isSafeUrl("http://example.com");
    expect(result).toBe(false);
  });

  test("should return true for HTTP with allowHttp", () => {
    const result = isSafeUrl("http://example.com", { allowHttp: true });
    expect(result).toBe(true);
  });

  test("should return true for unknown hostnames", () => {
    const result = isSafeUrl("https://nonexistent-domain-12345.test");
    expect(result).toBe(true);
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
    expect(
      isSameOrigin("https://example.com:8443", "https://example.com:8443")
    ).toBe(true);
  });

  test("should return false for different schemes", () => {
    expect(isSameOrigin("http://example.com", "https://example.com")).toBe(
      false
    );
  });

  test("should return false for different hosts", () => {
    expect(isSameOrigin("https://example.com", "https://other.com")).toBe(
      false
    );
    expect(
      isSameOrigin("https://example.com", "https://subdomain.example.com")
    ).toBe(false);
  });

  test("should return false for different ports", () => {
    expect(
      isSameOrigin("https://example.com:443", "https://example.com:8443")
    ).toBe(false);
    expect(
      isSameOrigin("http://example.com:8080", "http://example.com:9090")
    ).toBe(false);
  });

  test("should return false for invalid URLs", () => {
    expect(isSameOrigin("invalid", "https://example.com")).toBe(false);
    expect(isSameOrigin("https://example.com", "not-a-url")).toBe(false);
    expect(isSameOrigin("", "")).toBe(false);
  });

  test("should handle subdomain as different origin", () => {
    expect(isSameOrigin("https://sub.example.com", "https://example.com")).toBe(
      false
    );
    expect(
      isSameOrigin("https://www.example.com", "https://api.example.com")
    ).toBe(false);
  });

  test("should be case-insensitive for hosts", () => {
    expect(isSameOrigin("https://Example.com", "https://example.com")).toBe(
      true
    );
    expect(isSameOrigin("HTTPS://EXAMPLE.COM", "https://example.com")).toBe(
      true
    );
  });
});

describe("Real-world URLs", () => {
  test("should allow valid webhook URLs", () => {
    const result = isSafeUrl("https://webhook.site/unique-id");
    expect(result).toBe(true);
  });

  test("should handle HTTPS external APIs", () => {
    // Changed to use example.com which is known to be safe
    // api.example.com may not exist and cause DNS resolution failure
    const result = isSafeUrl("https://www.google.com");
    expect(result).toBe(true);
  });

  test("should reject localhost callbacks by default", () => {
    const result = isSafeUrl("https://localhost:3000/callback");
    expect(result).toBe(false);
  });

  test("should allow localhost callbacks with flag", () => {
    const result = isSafeUrl("https://localhost:3000/callback", {
      allowPrivate: true,
    });
    expect(result).toBe(true);
  });
});

describe("address spellings", () => {
  const blocked = (url: string) =>
    expect(() => validateSafeUrl(url), url).toThrow();
  const allowed = (url: string) => expect(validateSafeUrl(url), url).toBe(url);

  test("bracketed IPv6 literals", () => {
    blocked("https://[::1]/");
    blocked("https://[::]/");
    blocked("https://[fd12:3456::1]/");
    blocked("https://[fe80::1]/");
    blocked("https://[ff02::1]/");
    allowed("https://[2606:4700:4700::1111]/");
  });

  test("IPv4-mapped IPv6 in every spelling", () => {
    // new URL() rewrites the dotted form to hex: ::ffff:7f00:1
    blocked("https://[::ffff:127.0.0.1]/");
    blocked("https://[::ffff:7f00:1]/");
    blocked("https://[0:0:0:0:0:ffff:7f00:1]/");
    blocked("https://[::ffff:10.0.0.1]/");
    blocked("https://[::ffff:169.254.169.254]/");
    allowed("https://[::ffff:8.8.8.8]/");
  });

  test("IPv4 embedded in 6to4, Teredo and NAT64", () => {
    blocked("https://[2002:7f00:1::]/"); // 6to4 127.0.0.1
    blocked("https://[2002:a9fe:a9fe::1]/"); // 6to4 169.254.169.254
    allowed("https://[2002:808:808::1]/"); // 6to4 8.8.8.8
    blocked("https://[2001:0:4136:e378:8000:63bf:80ff:fffe]/"); // Teredo client 127.0.0.1
    allowed("https://[2001:0:4136:e378:8000:63bf:f7f7:f7f7]/"); // Teredo client 8.8.8.8
    blocked("https://[64:ff9b::7f00:1]/"); // NAT64 127.0.0.1
    blocked("https://[64:ff9b::a00:1]/"); // NAT64 10.0.0.1
    allowed("https://[64:ff9b::808:808]/"); // NAT64 8.8.8.8
  });

  test("local NAT64, IPv4-compatible and documentation IPv6 ranges", () => {
    blocked("https://[64:ff9b:1::808:808]/");
    blocked("https://[::808:808]/");
    blocked("https://[2001:db8::1]/");
  });

  test.each([
    "100.64.0.1",
    "192.0.0.1",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
  ])("reserved IPv4 range %s", (ip) => {
    blocked(`https://${ip}/`);
    expect(isPrivateIp(ip)).toBe(true);
  });

  test("non-canonical IPv4 forms are canonicalized by URL", () => {
    expect(new URL("https://127.1/").hostname).toBe("127.0.0.1");
    blocked("https://127.1/");
    blocked("https://0x7f000001/");
    blocked("https://2130706433/");
    blocked("https://0177.0.0.1/");
    blocked("https://0/");
  });

  test("cloud metadata is blocked even with allowPrivate", () => {
    for (const url of [
      "https://169.254.169.254/",
      "https://169.254.170.2/",
      "https://169.254.170.23/",
      "https://169.254.1.1/",
      "https://100.100.100.200/",
      "https://[fd00:ec2::254]/",
      "https://[fd00:ec2::23]/",
      "https://[fe80::a9fe:a9fe]/",
      "https://metadata.google.internal/",
      "https://metadata.amazonaws.com/",
      "https://METADATA.google.internal./",
    ]) {
      expect(() => validateSafeUrl(url, { allowPrivate: true }), url).toThrow(
        /metadata/
      );
    }
  });

  test("localhost and Kubernetes names", () => {
    blocked("https://host.docker.internal/");
    blocked("https://localhost./");
    blocked("https://app.localhost/");
    blocked("https://api.default.svc.cluster.local/");
    expect(
      validateSafeUrl("https://api.default.svc.cluster.local/", {
        blockK8sInternal: false,
      })
    ).toBe("https://api.default.svc.cluster.local/");
  });

  test("allowedHosts skip the host checks but not metadata", () => {
    expect(
      validateSafeUrl("https://10.0.0.5/", { allowedHosts: ["10.0.0.5"] })
    ).toBe("https://10.0.0.5/");
    expect(
      validateSafeUrl("https://localhost/", { allowedHosts: ["LOCALHOST"] })
    ).toBe("https://localhost/");
    expect(() =>
      validateSafeUrl("https://169.254.169.254/", {
        allowedHosts: ["169.254.169.254"],
      })
    ).toThrow(/metadata/);
  });

  test("policy options", () => {
    expect(
      validateSafeUrl("http://example.com/", { allowedSchemes: ["http"] })
    ).toBe("http://example.com/");
    expect(() =>
      validateSafeUrl("https://example.com/", { allowedSchemes: ["http"] })
    ).toThrow(/scheme/);
    expect(
      validateSafeUrl("https://192.168.1.1/", { blockPrivateIps: false })
    ).toBe("https://192.168.1.1/");
    expect(() =>
      validateSafeUrl("https://127.0.0.1/", { blockPrivateIps: false })
    ).toThrow(/localhost/);
  });
});
