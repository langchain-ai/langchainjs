import { test, expect } from "vitest";

import { TavilyCrawl } from "../tavily-crawl.js";

test("TavilyCrawl can perform a crawl given a url", async () => {
  const tavilyCrawlTool = new TavilyCrawl();

  const toolData = await tavilyCrawlTool.invoke({
    url: "https://www.langchain.com/",
  });

  expect("results" in toolData).toBeTruthy();
  expect(toolData.results.length).toBeGreaterThan(0);
});
