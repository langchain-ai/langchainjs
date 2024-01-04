import { test } from "@jest/globals";
import { GoogleCustomSearch } from "../google_custom_search.js";

test.skip("GoogleCustomSearchTool", async () => {
  const tool = new GoogleCustomSearch();

  const result = await tool.call("What is Langchain?");

  console.log({ result });
});
