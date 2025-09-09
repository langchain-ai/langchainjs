import {
  it,
  expect,
  describe,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

describe("insecureHash", () => {
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    // Save and mock console.warn
    originalConsoleWarn = console.warn;
    console.warn = jest.fn(console.log);
    // Reset the hasLoggedWarning flag by re-importing the module
    // This is a workaround since hasLoggedWarning is module-scoped.
    jest.resetModules();
  });

  afterEach(() => {
    // Restore console.warn
    console.warn = originalConsoleWarn;
  });

  it("should emit a console.warn once on first use", async () => {
    const { insecureHash } = await import("../js-sha1/hash.js");
    insecureHash("foo");
    expect(console.warn).toHaveBeenCalledTimes(1);
    insecureHash("bar");
    expect(console.warn).toHaveBeenCalledTimes(1);
    insecureHash("baz");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("should return a hash string", async () => {
    const { insecureHash } = await import("../js-sha1/hash.js");
    const hash = insecureHash("foo");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});

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
