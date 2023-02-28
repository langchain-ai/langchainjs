import url from "url";
import path from "path";
import { test, expect } from "@jest/globals";
import { JSONLinesLoader } from "../jsonl.js";
import { Document } from "../../document.js";

test("Test JSON loader", async () => {
  const loader = new JSONLinesLoader(
    path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl"
    ),
    "/html"
  );
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: {
        source:
          "/Users/nuno/dev/langchainjs/langchain/src/document_loaders/tests/example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl",
      },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});
