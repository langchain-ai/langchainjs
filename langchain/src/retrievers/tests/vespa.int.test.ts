/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";

import { VespaRetriever } from "../vespa.js";

test.skip("VespaRetriever", async () => {
  const url = process.env.VESPA_URL!;
  const query_body = {
    yql: "select * from music where album contains 'head';",
    hits: 5,
    locale: "en-us",
  };
  const content_field = "album";

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
