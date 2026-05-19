import { vi, test, expect, describe, beforeEach, afterEach } from "vitest";
import { Document } from "@langchain/core/documents";
import { PerplexitySearchRetriever } from "../retrievers.js";

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
      date: null,
      last_updated: null,
    },
  ],
};

function mockFetchOnce(response: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(typeof response === "string" ? response : ""),
  });
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = fetchMock;
  return fetchMock;
}

describe("PerplexitySearchRetriever", () => {
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
    test("creates instance with required fields and defaults", () => {
      const retriever = new PerplexitySearchRetriever({ apiKey: "test-key" });
      expect(retriever.k).toBe(10);
      expect(retriever.maxTokens).toBe(25000);
      expect(retriever.maxTokensPerPage).toBe(1024);
      expect(retriever.apiKey).toBe("test-key");
    });

    test("throws error when no API key is provided", () => {
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.PPLX_API_KEY;
      expect(() => new PerplexitySearchRetriever()).toThrow(
        "Perplexity API key not found"
      );
    });

    test("falls back to PERPLEXITY_API_KEY env var", () => {
      process.env.PERPLEXITY_API_KEY = "env-key";
      delete process.env.PPLX_API_KEY;
      const retriever = new PerplexitySearchRetriever();
      expect(retriever.apiKey).toBe("env-key");
    });

    test("falls back to PPLX_API_KEY env var", () => {
      delete process.env.PERPLEXITY_API_KEY;
      process.env.PPLX_API_KEY = "pplx-key";
      const retriever = new PerplexitySearchRetriever();
      expect(retriever.apiKey).toBe("pplx-key");
    });

    test("sets optional parameters correctly", () => {
      const retriever = new PerplexitySearchRetriever({
        apiKey: "test-key",
        k: 5,
        maxTokens: 1000,
        maxTokensPerPage: 200,
        country: "US",
        searchDomainFilter: ["wikipedia.org"],
        searchRecencyFilter: "week",
        searchAfterDate: "01/01/2025",
        searchBeforeDate: "12/31/2025",
      });
      expect(retriever.k).toBe(5);
      expect(retriever.maxTokens).toBe(1000);
      expect(retriever.maxTokensPerPage).toBe(200);
      expect(retriever.country).toBe("US");
      expect(retriever.searchDomainFilter).toEqual(["wikipedia.org"]);
      expect(retriever.searchRecencyFilter).toBe("week");
      expect(retriever.searchAfterDate).toBe("01/01/2025");
      expect(retriever.searchBeforeDate).toBe("12/31/2025");
    });

    test("lc_name returns PerplexitySearchRetriever", () => {
      expect(PerplexitySearchRetriever.lc_name()).toBe(
        "PerplexitySearchRetriever"
      );
    });
  });

  describe("buildRequestBody", () => {
    test("includes default parameters", () => {
      const retriever = new PerplexitySearchRetriever({ apiKey: "test-key" });
      const body = retriever.buildRequestBody("hello");
      expect(body).toEqual({
        query: "hello",
        max_results: 10,
        max_tokens: 25000,
        max_tokens_per_page: 1024,
      });
    });

    test("omits unset optional parameters", () => {
      const retriever = new PerplexitySearchRetriever({ apiKey: "test-key" });
      const body = retriever.buildRequestBody("hello");
      expect(body).not.toHaveProperty("country");
      expect(body).not.toHaveProperty("search_domain_filter");
      expect(body).not.toHaveProperty("search_recency_filter");
      expect(body).not.toHaveProperty("search_after_date");
      expect(body).not.toHaveProperty("search_before_date");
    });

    test("includes all provided optional parameters", () => {
      const retriever = new PerplexitySearchRetriever({
        apiKey: "test-key",
        k: 5,
        maxTokens: 1000,
        maxTokensPerPage: 200,
        country: "US",
        searchDomainFilter: ["wikipedia.org", "arxiv.org"],
        searchRecencyFilter: "month",
        searchAfterDate: "01/01/2025",
        searchBeforeDate: "12/31/2025",
      });
      const body = retriever.buildRequestBody("query");
      expect(body).toEqual({
        query: "query",
        max_results: 5,
        max_tokens: 1000,
        max_tokens_per_page: 200,
        country: "US",
        search_domain_filter: ["wikipedia.org", "arxiv.org"],
        search_recency_filter: "month",
        search_after_date: "01/01/2025",
        search_before_date: "12/31/2025",
      });
    });
  });

  describe("_getRelevantDocuments", () => {
    test("posts to /search and returns Document[] with metadata", async () => {
      const fetchMock = mockFetchOnce(MOCK_RESPONSE);
      const retriever = new PerplexitySearchRetriever({
        apiKey: "test-key",
        k: 3,
        searchRecencyFilter: "day",
      });

      const docs = await retriever._getRelevantDocuments("test query");

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
        max_results: 3,
        max_tokens: 25000,
        max_tokens_per_page: 1024,
        search_recency_filter: "day",
      });

      expect(docs).toHaveLength(2);
      expect(docs[0]).toBeInstanceOf(Document);
      expect(docs[0].pageContent).toBe("First snippet");
      expect(docs[0].metadata).toEqual({
        title: "Result 1",
        url: "https://example.com/1",
        date: "2025-01-01",
        last_updated: "2025-01-02",
      });
      expect(docs[1].metadata).toEqual({
        title: "Result 2",
        url: "https://example.com/2",
        date: null,
        last_updated: null,
      });
    });

    test("returns empty list when results are missing", async () => {
      mockFetchOnce({ id: "x" });
      const retriever = new PerplexitySearchRetriever({ apiKey: "test-key" });
      const docs = await retriever._getRelevantDocuments("q");
      expect(docs).toEqual([]);
    });

    test("throws on non-OK response", async () => {
      mockFetchOnce("rate limited", false, 429);
      const retriever = new PerplexitySearchRetriever({ apiKey: "test-key" });
      await expect(retriever._getRelevantDocuments("q")).rejects.toThrow(
        /Perplexity Search API error \(429\)/
      );
    });

    test("invoke proxies to _getRelevantDocuments", async () => {
      mockFetchOnce(MOCK_RESPONSE);
      const retriever = new PerplexitySearchRetriever({ apiKey: "test-key" });
      const docs = await retriever.invoke("hi");
      expect(docs).toHaveLength(2);
      expect(docs[0].pageContent).toBe("First snippet");
    });
  });
});
