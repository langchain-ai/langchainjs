/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { TavilySearchAPIRetriever } from "../tavily_search_api.js";

test.skip("TavilySearchAPIRetriever", async () => {
  const retriever = new TavilySearchAPIRetriever({
    includeImages: true,
    includeRawContent: true,
  });

  const docs = await retriever.getRelevantDocuments("what bear is best?");
  expect(docs.length).toBeGreaterThan(0);

  console.log(docs);
});
