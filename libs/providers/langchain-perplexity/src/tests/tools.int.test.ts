import { describe, test, expect } from "vitest";
import { PerplexitySearchResults } from "../tools.js";

const hasKey = !!process.env.PERPLEXITY_API_KEY || !!process.env.PPLX_API_KEY;

describe.skipIf(!hasKey)("PerplexitySearchResults Integration", () => {
  test("returns JSON-encoded results from a real /search call", async () => {
    const tool = new PerplexitySearchResults({ maxResults: 3 });
    const result = await tool.invoke("What is the capital of India?");
    const parsed = JSON.parse(result);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.length).toBeLessThanOrEqual(3);
    for (const item of parsed) {
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("url");
      expect(item).toHaveProperty("snippet");
      expect(item).toHaveProperty("date");
      expect(item).toHaveProperty("last_updated");
    }
  });
});
