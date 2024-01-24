import { test, expect } from "@jest/globals";
import Exa from "exa-js";
import { ExaRetriever, _getMetadata } from "../retrievers.js";

test("ExaRetriever can retrieve some data", async () => {
  const exaRetriever = new ExaRetriever({
    // @ts-expect-error type errors
    client: new Exa(),
  });

  const results = await exaRetriever.getRelevantDocuments(
    "What does the AI company LangChain do?"
  );

  console.log("results:", JSON.stringify(results, null, 2));
  expect(results.length).toBeGreaterThan(0);
  // verify metadata fields are populated
  expect(results[0].metadata.title).toBeGreaterThan(1);
  expect(results[0].metadata.url).toBeGreaterThan(1);
  expect(results[0].metadata.id).toBeGreaterThan(1);
});
