import { describe, expect, test, vi, afterEach } from "vitest";

import { HackerNewsTopStoriesTool } from "../hacker_news.js";

describe("HackerNewsTopStoriesTool", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("instantiates correctly", () => {
    const tool = new HackerNewsTopStoriesTool();

    expect(tool.name).toBe("hacker_news_top_stories");
  });

  test("_call returns formatted top stories", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [123],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          title: "Mock Story",
          url: "https://mock.com",
        }),
      } as Response);

    vi.stubGlobal("fetch", fetchMock);

    const tool = new HackerNewsTopStoriesTool();
    const result = await tool._call({ limit: 1 });

    expect(result).toContain("Mock Story");
    expect(result).toContain("https://mock.com");
  });
});
