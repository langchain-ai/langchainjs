import { afterEach, expect, test, vi } from "vitest";
import {
  TavilySearch,
  TavilyExtract,
  TavilyCrawl,
  TavilyMap,
} from "../index.js";
const fields = { tavilyApiKey: "fixture-key" };
const success = {
  results: [
    {
      url: "https://example.com",
      content: "fixture",
      raw_content: "full",
      published_date: "2026-10-01",
    },
  ],
  failed_results: [],
  request_id: "fixture",
  usage: { credits: 0 },
};
function capture() {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(success)));
  vi.stubGlobal("fetch", fetch);
  return () => JSON.parse(fetch.mock.calls[0][1].body as string);
}
afterEach(() => vi.unstubAllGlobals());
test.each(["fast", "ultra-fast"] as const)(
  "Search accepts %s through a real ToolCall",
  async (searchDepth) => {
    const body = capture();
    const result = await new TavilySearch(fields).invoke({
      type: "tool_call",
      id: "call",
      name: "tavily_search",
      args: { query: "fixture", searchDepth },
    });
    expect(body().search_depth).toBe(searchDepth);
    expect(result).toHaveProperty("tool_call_id", "call");
    expect(result.content).toContain("published_date");
  }
);
test("Search preserves optional filters, constructor precedence, false and metadata", async () => {
  const body = capture();
  const result = await new TavilySearch({
    ...fields,
    safeSearch: false,
    filterByLanguage: false,
    includeAnswer: "advanced",
  }).invoke({
    query: "fixture",
    startDate: "2026-10-01",
    endDate: "2026-10-02",
    language: "english",
    filterByLanguage: true,
    safeSearch: true,
    includeDomains: ["example.com"],
    includeDomainsMode: "prefer",
    includePublishedDate: false,
    filterByPublishedDate: false,
  });
  expect(body()).toMatchObject({
    start_date: "2026-10-01",
    end_date: "2026-10-02",
    language: "english",
    filter_by_language: false,
    safe_search: false,
    include_answer: "advanced",
    include_domains_mode: "prefer",
    include_published_date: false,
    filter_by_published_date: false,
  });
  expect(result).toEqual(success);
});
test("Search omitted options remain omitted", async () => {
  const body = capture();
  await new TavilySearch(fields).invoke({ query: "fixture" });
  expect(body()).toEqual({ query: "fixture" });
});
test("Search permits zero results with answer metadata", async () => {
  const result = {
    results: [],
    answer: "fixture answer",
    usage: { credits: 0 },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(result)))
  );
  expect(
    await new TavilySearch({
      ...fields,
      maxResults: 0,
      includeAnswer: true,
    }).invoke({ query: "fixture" })
  ).toEqual(result);
});
test.each([
  {
    name: "Extract",
    make: () => new TavilyExtract({ ...fields, timeout: 30 }),
    args: {
      urls: ["https://example.com"],
      query: "fixture",
      chunksPerSource: 5,
      timeout: 10,
    },
    expected: { chunks_per_source: 5, timeout: 30 },
  },
  {
    name: "Crawl",
    make: () => new TavilyCrawl({ ...fields, timeout: 150 }),
    args: {
      url: "https://example.com",
      instructions: "fixture",
      chunksPerSource: 5,
      timeout: 10,
    },
    expected: { chunks_per_source: 5, timeout: 150 },
  },
  {
    name: "Map",
    make: () => new TavilyMap({ ...fields, timeout: 150 }),
    args: { url: "https://example.com", timeout: 10 },
    expected: { timeout: 150 },
  },
])(
  "$name options survive public invocation with constructor precedence",
  async ({ make, args, expected }) => {
    const body = capture();
    expect(await make().invoke(args)).toEqual(success);
    expect(body()).toMatchObject(expected);
  }
);
test.each([
  {
    make: () => new TavilyExtract(fields),
    args: { urls: ["https://example.com"], chunksPerSource: 6 },
  },
  {
    make: () => new TavilyExtract(fields),
    args: { urls: ["https://example.com"], timeout: 61 },
  },
  {
    make: () => new TavilyCrawl(fields),
    args: { url: "https://example.com", timeout: 9 },
  },
  {
    make: () => new TavilyMap(fields),
    args: { url: "https://example.com", timeout: 151 },
  },
])("invalid new tool options fail before HTTP", async ({ make, args }) => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(make().invoke(args)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
