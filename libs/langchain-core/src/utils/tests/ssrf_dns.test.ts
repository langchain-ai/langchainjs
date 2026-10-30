import { describe, test, expect, vi, beforeEach } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns", () => ({
  promises: { lookup: lookupMock },
  default: { promises: { lookup: lookupMock } },
}));

import {
  validateSafeUrlAsync,
  isSafeUrlAsync,
  validateSafeUrl,
} from "../ssrf.js";

function resolvesTo(...addresses: string[]) {
  lookupMock.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }))
  );
}

describe("validateSafeUrlAsync", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  test("allows a hostname that resolves to a public IP", async () => {
    resolvesTo("93.184.216.34");
    await expect(
      validateSafeUrlAsync("https://example.com/path")
    ).resolves.toBe("https://example.com/path");
    expect(lookupMock).toHaveBeenCalledWith("example.com", {
      all: true,
      verbatim: true,
    });
  });

  test("allows a hostname that resolves to public IPv4 and IPv6", async () => {
    resolvesTo("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946");
    expect(await isSafeUrlAsync("https://example.com")).toBe(true);
  });

  test.each([
    ["RFC 1918 10/8", "10.0.0.5"],
    ["RFC 1918 172.16/12", "172.20.1.1"],
    ["RFC 1918 192.168/16", "192.168.1.10"],
    ["loopback", "127.0.0.1"],
    ["loopback range", "127.8.9.10"],
    ["IPv6 loopback", "::1"],
    ["IPv6 ULA", "fd12:3456:789a::1"],
    ["IPv6 link-local", "fe80::1"],
    ["0.0.0.0", "0.0.0.0"],
  ])("rejects a hostname that resolves to %s", async (_label, ip) => {
    resolvesTo(ip);
    await expect(
      validateSafeUrlAsync("https://internal.attacker.example")
    ).rejects.toThrow(/private IP|localhost/);
  });

  test.each([
    ["AWS/GCP/Azure", "169.254.169.254"],
    ["ECS task metadata", "169.254.170.2"],
    ["Alibaba", "100.100.100.200"],
  ])("rejects a hostname that resolves to %s metadata", async (_label, ip) => {
    resolvesTo(ip);
    await expect(
      validateSafeUrlAsync("https://metadata.attacker.example")
    ).rejects.toThrow(/cloud metadata/);
  });

  test("rejects when any resolved address is private", async () => {
    resolvesTo("93.184.216.34", "10.0.0.1");
    await expect(
      validateSafeUrlAsync("https://mixed.attacker.example")
    ).rejects.toThrow(/private IP: 10\.0\.0\.1/);
  });

  test.each([
    ["dotted", "::ffff:127.0.0.1", /localhost/],
    ["hex", "::ffff:7f00:1", /localhost/],
    ["private", "::ffff:10.0.0.1", /private IP: 10\.0\.0\.1/],
    ["metadata", "::ffff:a9fe:a9fe", /cloud metadata IP: 169\.254\.169\.254/],
  ])("rejects IPv4-mapped IPv6 (%s)", async (_label, ip, expected) => {
    resolvesTo(ip);
    await expect(
      validateSafeUrlAsync("https://mapped.attacker.example")
    ).rejects.toThrow(expected);
  });

  test("rejects bracketed IPv6 literals that the sync check lets through", async () => {
    // URL.hostname keeps the brackets, so the static check doesn't see an IP
    expect(validateSafeUrl("https://[::1]/")).toBe("https://[::1]/");
    await expect(validateSafeUrlAsync("https://[::1]/")).rejects.toThrow(
      /localhost/
    );
    await expect(
      validateSafeUrlAsync("https://[::ffff:169.254.169.254]/")
    ).rejects.toThrow(/cloud metadata/);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  test("allowPrivate permits private and loopback addresses", async () => {
    resolvesTo("10.0.0.5", "127.0.0.1");
    await expect(
      validateSafeUrlAsync("https://internal.example", { allowPrivate: true })
    ).resolves.toBe("https://internal.example");
  });

  test("allowPrivate still blocks cloud metadata addresses", async () => {
    resolvesTo("169.254.169.254");
    await expect(
      validateSafeUrlAsync("https://internal.example", { allowPrivate: true })
    ).rejects.toThrow(/cloud metadata/);
  });

  test("still runs the static checks before resolving", async () => {
    await expect(validateSafeUrlAsync("http://example.com")).rejects.toThrow(
      /HTTP scheme not allowed/
    );
    await expect(
      validateSafeUrlAsync("https://metadata.google.internal")
    ).rejects.toThrow(/cloud metadata/);
    await expect(validateSafeUrlAsync("https://10.0.0.1")).rejects.toThrow(
      /private IP/
    );
    expect(lookupMock).not.toHaveBeenCalled();
  });

  test("allowHttp is passed through", async () => {
    resolvesTo("93.184.216.34");
    await expect(
      validateSafeUrlAsync("http://example.com", { allowHttp: true })
    ).resolves.toBe("http://example.com");
  });

  test("fails closed when the hostname does not resolve", async () => {
    lookupMock.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" })
    );
    await expect(
      validateSafeUrlAsync("https://does-not-exist.example")
    ).rejects.toThrow(
      /Could not resolve hostname: does-not-exist\.example \(ENOTFOUND\)/
    );
  });

  test("fails closed when lookup returns no addresses", async () => {
    resolvesTo();
    expect(await isSafeUrlAsync("https://empty.example")).toBe(false);
  });
});

describe("isSafeUrlAsync", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  test("returns true for public and false for private", async () => {
    resolvesTo("1.1.1.1");
    expect(await isSafeUrlAsync("https://one.example")).toBe(true);
    resolvesTo("192.168.0.1");
    expect(await isSafeUrlAsync("https://router.example")).toBe(false);
  });
});
