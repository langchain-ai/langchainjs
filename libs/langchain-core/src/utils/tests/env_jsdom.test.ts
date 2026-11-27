import { afterEach, describe, expect, test, vi } from "vitest";
import { getEnv } from "../env.js";

// jsdom installs a window object with a document, so isBrowser() is already
// true there. getEnv must still be able to name the runtime it runs in.
function withJsdomGlobals() {
  vi.stubGlobal("window", { document: {}, name: "nodejs" });
  vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 jsdom/24.1.0" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getEnv", () => {
  test("reports jsdom when window and document come from a jsdom global", () => {
    withJsdomGlobals();
    expect(getEnv()).toBe("jsdom");
  });

  test("reports jsdom for a window named nodejs even without the user agent", () => {
    vi.stubGlobal("window", { document: {}, name: "nodejs" });
    expect(getEnv()).toBe("jsdom");
  });

  test("still reports a plain browser", () => {
    vi.stubGlobal("window", { document: {}, name: "" });
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Macintosh)" });
    expect(getEnv()).toBe("browser");
  });

  test("still reports node", () => {
    expect(getEnv()).toBe("node");
  });
});
