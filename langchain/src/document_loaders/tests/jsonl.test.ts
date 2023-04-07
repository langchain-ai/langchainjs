import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { JSONLinesLoader } from "../path/jsonl.js";
import { Document } from "../../document.js";

test("Test JSON loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl"
  );
  const loader = new JSONLinesLoader(filePath, "/html");
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});
