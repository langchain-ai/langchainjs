import { test, expect } from "@jest/globals";
import { DuckDuckGo } from "../../tools/duckduckgo.js";

describe("duckduckgo test suite", () => {
  test("get a search result", async () => {
    const duckduckgo = new DuckDuckGo();
    const result = await duckduckgo.call("launch africa ventures");
    expect(result).toContain("Launch Africa Ventures");
  });
});
