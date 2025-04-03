import { test, expect } from "@jest/globals";
import { TavilySearch } from "../tavily-search.js";

test("TavilySearch can perform a search given a string query", async () => {
  const tavilySearchTool = new TavilySearch();

  const toolData = await tavilySearchTool.invoke({
    query: "What does the AI company LangChain do?",
  });

  expect("results" in toolData).toBeTruthy();
  expect(toolData.results.length).toBeGreaterThan(0);
});
