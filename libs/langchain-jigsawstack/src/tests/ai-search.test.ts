import { it, expect } from "@jest/globals";
import { JigsawStackAISearch } from "../tools/ai-search.js";

it("should run successfully and return the search result", async () => {
  const tool = new JigsawStackAISearch();
  const metadata = await tool.invoke("The leaning tower of pisa");
  const jsonData = JSON.parse(metadata);
  expect(jsonData).toBeTruthy();
  expect(jsonData.success).toBe(true);
});
