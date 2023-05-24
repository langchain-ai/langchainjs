/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { test } from "@jest/globals";
import { GoogleCustomSearch } from "../google_custom_search.js";

test("GoogleCustomSearchTool", async () => {
  const tool = new GoogleCustomSearch({
    apiKey: process.env.GOOGLE_CUSTOM_SEARCH_API_KEY!,
    searchEngineId: process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID!,
  });

  const result = await tool.call("What is Langchain?");

  console.log({ result });
});
