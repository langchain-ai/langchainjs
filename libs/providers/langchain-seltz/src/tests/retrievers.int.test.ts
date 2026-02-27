import { test, expect } from "vitest";
import { Seltz } from "seltz";
import { SeltzRetriever } from "../retrievers.js";

test("SeltzRetriever can retrieve some data", async () => {
  const retriever = new SeltzRetriever({
    client: new Seltz(),
  });

  const results = await retriever.invoke(
    "What does the AI company LangChain do?"
  );

  expect(results.length).toBeGreaterThan(0);
  expect(results[0].metadata.url).toBeDefined();
});
