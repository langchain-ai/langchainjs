import { vi, test, expect, describe, beforeEach, afterEach } from "vitest";
import { PerplexitySearchResults } from "../tools.js";

const MOCK_RESPONSE = {
  id: "search-id-1",
  results: [
    {
      title: "Result 1",
      url: "https://example.com/1",
      snippet: "First snippet",
      date: "2025-01-01",
      last_updated: "2025-01-02",
    },
    {
      title: "Result 2",
      url: "https://example.com/2",
      snippet: "Second snippet",
    },
  ],
};

function mockFetchOnce(response: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
    text: () =>
      Promise.resolve(typeof response === "string" ? response : ""),
  });
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = fetchMock;
  return fetchMock;
}

describe("PerplexitySearchResults", () => {
  let originalFetch: typeof fetch;
  let originalApiKey: string | undefined;
  let originalPplxKey: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalApiKey = process.env.PERPLEXITY_API_KEY;
    originalPplxKey = process.env.PPLX_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.PERPLEXITY_API_KEY;
    } else {
      process.env.PERPLEXITY_API_KEY = originalApiKey;
    }
    if (originalPplxKey === undefined) {
      delete process.env.PPLX_API_KEY;
    } else {
      process.env.PPLX_API_KEY = originalPplxKey;
    }
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    test("uses default name and description", () => {
      const tool = new PerplexitySearchResults({ apiKey: "test-key" });
      expect(tool.name).toBe("perplexity_search_results_json");
      expect(tool.description).toBe(
        "A wrapper around Perplexity Search. " +
          "Input should be a search query. " +
          "Output is a JSON array of the query results"
      );
      expect(tool.maxResults).toBe(10);
    });

    test("throws error when no API key is provided", () => {
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.PPLX_API_KEY;
      expect(() => new PerplexitySearchResults()).toThrow(
        "Perplexity API key not found"
      );
    });

    test("falls back to PERPLEXITY_API_KEY env var", () => {
      process.env.PERPLEXITY_API_KEY = "env-key";
      delete process.env.PPLX_API_KEY;
      const tool = new PerplexitySearchResults();
      expect(tool.apiKey).toBe("env-key");
    });

    test("falls back to PPLX_API_KEY env var", () => {
      delete process.env.PERPLEXITY_API_KEY;
      process.env.PPLX_API_KEY = "pplx-key";
      const tool = new PerplexitySearchResults();
      expect(tool.apiKey).toBe("pplx-key");
    });

    test("sets optional parameters correctly", () => {
      const tool = new PerplexitySearchResults({
        apiKey: "test-key",
        maxResults: 5,
        country: "US",
        searchDomainFilter: ["wikipedia.org"],
        searchRecencyFilter: "week",
        searchAfterDate: "01/01/2025",
        searchBeforeDate: "12/31/2025",
      });
      expect(tool.maxResults).toBe(5);
      expect(tool.country).toBe("US");
      expect(tool.searchDomainFilter).toEqual(["wikipedia.org"]);
      expect(tool.searchRecencyFilter).toBe("week");
      expect(tool.searchAfterDate).toBe("01/01/2025");
      expect(tool.searchBeforeDate).toBe("12/31/2025");
    });

    test("lc_name returns PerplexitySearchResults", () => {
      expect(PerplexitySearchResults.lc_name()).toBe("PerplexitySearchResults");
    });

    test("has a defined schema", () => {
      const tool = new PerplexitySearchResults({ apiKey: "test-key" });
      expect(tool.schema).toBeDefined();
    });
  });

  describe("buildRequestBody", () => {
    test("includes max_results and omits unset filters", () => {
      const tool = new PerplexitySearchResults({ apiKey: "test-key" });
      const body = tool.buildRequestBody("query");
      expect(body).toEqual({ query: "query", max_results: 10 });
    });

    test("includes all provided filters", () => {
      const tool = new PerplexitySearchResults({
        apiKey: "test-key",
        maxResults: 3,
        country: "US",
        searchDomainFilter: ["arxiv.org"],
        searchRecencyFilter: "month",
        searchAfterDate: "01/01/2025",
        searchBeforeDate: "12/31/2025",
      });
      const body = tool.buildRequestBody("query");
      expect(body).toEqual({
        query: "query",
        max_results: 3,
        country: "US",
        search_domain_filter: ["arxiv.org"],
        search_recency_filter: "month",
        search_after_date: "01/01/2025",
        search_before_date: "12/31/2025",
      });
    });
  });

  describe("_call", () => {
    test("posts to /search and returns JSON-encoded results", async () => {
      const fetchMock = mockFetchOnce(MOCK_RESPONSE);
      const tool = new PerplexitySearchResults({
        apiKey: "test-key",
        maxResults: 4,
        searchRecencyFilter: "day",
      });

      const result = await tool.invoke("test query");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.perplexity.ai/search");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      });
      expect(JSON.parse(init.body)).toEqual({
        query: "test query",
        max_results: 4,
        search_recency_filter: "day",
      });

      const parsed = JSON.parse(result);
      expect(parsed).toEqual([
        {
          title: "Result 1",
          url: "https://example.com/1",
          snippet: "First snippet",
          date: "2025-01-01",
          last_updated: "2025-01-02",
        },
        {
          title: "Result 2",
          url: "https://example.com/2",
          snippet: "Second snippet",
          date: null,
          last_updated: null,
        },
      ]);
    });

    test("returns error message string on non-OK response", async () => {
      mockFetchOnce("server boom", false, 500);
      const tool = new PerplexitySearchResults({ apiKey: "test-key" });
      const result = await tool.invoke("q");
      expect(result).toContain("Perplexity search failed");
      expect(result).toContain("500");
    });

    test("returns error message string on fetch throw", async () => {
      // oxlint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = vi.fn().mockRejectedValue(
        new TypeError("network down")
      );
      const tool = new PerplexitySearchResults({ apiKey: "test-key" });
      const result = await tool.invoke("q");
      expect(result).toBe("Perplexity search failed: TypeError");
    });

    test("returns empty array when results are missing", async () => {
      mockFetchOnce({ id: "x" });
      const tool = new PerplexitySearchResults({ apiKey: "test-key" });
      const result = await tool.invoke("q");
      expect(JSON.parse(result)).toEqual([]);
    });
  });
});
