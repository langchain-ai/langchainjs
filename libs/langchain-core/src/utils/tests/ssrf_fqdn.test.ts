import { describe, test, expect } from "vitest";
import { isSafeUrl, validateSafeUrl } from "../ssrf.js";

describe("validateSafeUrl absolute FQDN hostnames", () => {
  test("blocks localhost written as an absolute FQDN", () => {
    // A single trailing dot is the DNS root label: resolvers treat
    // "localhost." exactly like "localhost".
    expect(() => validateSafeUrl("https://localhost./")).toThrow(/localhost/);
    expect(() => validateSafeUrl("https://localhost./api/v1")).toThrow(
      /localhost/
    );
    expect(() =>
      validateSafeUrl("http://localhost.:8080/", { allowHttp: true })
    ).toThrow(/localhost/);
    expect(isSafeUrl("https://localhost./")).toBe(false);
  });

  test("blocks cloud metadata names written as an absolute FQDN", () => {
    expect(() =>
      validateSafeUrl("https://metadata.google.internal./computeMetadata/v1/")
    ).toThrow(/cloud metadata/);
    expect(() => validateSafeUrl("https://metadata./")).toThrow(
      /cloud metadata/
    );
    expect(() => validateSafeUrl("https://instance-data./latest/")).toThrow(
      /cloud metadata/
    );
  });

  test("keeps allowing an ordinary host written as an absolute FQDN", () => {
    expect(validateSafeUrl("https://example.com./")).toBe(
      "https://example.com./"
    );
    expect(validateSafeUrl("https://example.com./path?q=1")).toContain(
      "example.com"
    );
  });

  test("keeps the existing behavior for names and addresses without a dot", () => {
    expect(validateSafeUrl("https://example.com")).toBe("https://example.com");
    expect(() => validateSafeUrl("https://localhost/")).toThrow(/localhost/);
    expect(() =>
      validateSafeUrl("http://10.0.0.1/", { allowHttp: true })
    ).toThrow(/private IP/);
    expect(validateSafeUrl("https://localhost./", { allowPrivate: true })).toBe(
      "https://localhost./"
    );
    expect(
      validateSafeUrl("http://127.0.0.1/", {
        allowHttp: true,
        allowPrivate: true,
      })
    ).toBe("http://127.0.0.1/");
  });
});
