import { it, expect, describe } from "vitest";

describe("sha256", () => {
  it("should return different hashes for different inputs", async () => {
    const { sha256 } = await import("../js-sha256/hash.js");
    const hash1 = sha256("foo");
    const hash2 = sha256("bar");
    expect(hash1).not.toBe(hash2);
  });

  it("should return the same hash for the same input", async () => {
    const { sha256 } = await import("../js-sha256/hash.js");
    const hash1 = sha256("repeat");
    const hash2 = sha256("repeat");
    expect(hash1).toBe(hash2);
  });

  it("should hash multiple arguments as a concatenated string", async () => {
    const { sha256 } = await import("../js-sha256/hash.js");
    const hash1 = sha256("foo", "bar");
    const hash2 = sha256("foobar");
    expect(hash1).toBe(hash2);
  });
});
