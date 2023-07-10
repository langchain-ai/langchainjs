import { test } from "@jest/globals";
import { BraveSearch } from "../brave_search.js";

test.skip("BraveSearchTool", async () => {
  const tool = new BraveSearch();

  const result = await tool.call("What is Langchain?");

  console.log({ result });
});
