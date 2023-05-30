/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { VespaRetriever } from "../vespa.js";

test("VespaRetriever", async () => {
  const url = "https://doc-search.vespa.oath.cloud";
  const query_body = {
    yql: "select content from paragraph where userQuery()",
    hits: 5,
    ranking: "documentation",
    locale: "en-us",
  };
  const content_field = "content";

  const retriever = new VespaRetriever({
    url,
    auth: false,
    query_body,
    content_field,
  });

  const docs = await retriever.getRelevantDocuments("what is vespa?");
  expect(docs.length).toBeGreaterThan(0);

  console.log(docs);
});
