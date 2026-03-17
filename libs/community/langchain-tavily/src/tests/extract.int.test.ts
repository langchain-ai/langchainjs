import { test, expect } from "vitest";
import { TavilyExtract } from "../tavily-extract.js";

test("TavilySearch can perform a search given a string query", async () => {
  const tavilyExtractTool = new TavilyExtract();

  const toolData = await tavilyExtractTool.invoke({
    urls: ["https://www.langchain.com/"],
  });

  expect("results" in toolData).toBeTruthy();
  expect(toolData.results.length).toBeGreaterThan(0);
});
