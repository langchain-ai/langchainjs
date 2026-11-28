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

describe("SHA-256 standard digests", () => {
  it.each([
    [
      "empty",
      "",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ],
    [
      "abc",
      "abc",
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    ],
    [
      "two blocks",
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "million a",
      "a".repeat(1_000_000),
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    ],
  ])("matches the %s vector", async (_, input, expected) => {
    const { sha256 } = await import("../js-sha256/hash.js");
    expect(sha256(input)).toBe(expected);
  });

  it.each([0, 1, 55, 56, 63, 64, 65, 119, 120, 127, 128, 129])(
    "matches Node crypto for %i UTF-8 bytes",
    async (length) => {
      const { createHash } = await import("node:crypto");
      const { sha256 } = await import("../js-sha256/hash.js");
      const input = "x".repeat(length);
      expect(sha256(input)).toBe(
        createHash("sha256").update(input).digest("hex")
      );
    }
  );

  it("hashes Unicode arguments after concatenation", async () => {
    const { createHash } = await import("node:crypto");
    const { sha256 } = await import("../js-sha256/hash.js");
    const parts = ["é中文", "😀C:\\folder\\file\r\n${nested}"];
    expect(sha256(...parts)).toBe(
      createHash("sha256").update(parts.join("")).digest("hex")
    );
  });
});
