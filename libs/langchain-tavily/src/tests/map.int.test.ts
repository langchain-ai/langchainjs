import { test, expect } from "@jest/globals";
import { TavilyMap } from "../tavily-map.js";

test("TavilyMap can perform a map given a url", async () => {
  const tavilyMapTool = new TavilyMap();

  const toolData = await tavilyMapTool.invoke({
    url: "https://www.langchain.com/",
  });

  expect("results" in toolData).toBeTruthy();
  expect(toolData.results.length).toBeGreaterThan(0);
});
