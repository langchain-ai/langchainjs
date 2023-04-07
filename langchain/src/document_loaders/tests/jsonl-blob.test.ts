import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { test, expect } from "@jest/globals";
import { JSONLinesLoader } from "../path/jsonl.js";
import { Document } from "../../document.js";

test("Test JSONL loader from blob", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl"
  );
  const loader = new JSONLinesLoader(
    new Blob([await fs.readFile(filePath)], { type: "application/jsonl+json" }),
    "/html"
  );
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: "blob", blobType: "application/jsonl+json", line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});

test("Test JSONL loader from blob", async () => {
  const loader = new JSONLinesLoader(
    new Blob(
      [
        `{"html": "This is a sentence."}
{"html": "This is another sentence."}`,
      ],
      { type: "application/jsonl+json" }
    ),
    "/html"
  );
  const docs = await loader.load();
  expect(docs.length).toBe(2);
  expect(docs[0]).toMatchInlineSnapshot(`
    Document {
      "metadata": {
        "blobType": "application/jsonl+json",
        "line": 1,
        "source": "blob",
      },
      "pageContent": "This is a sentence.",
    }
  `);
  expect(docs[1]).toMatchInlineSnapshot(`
    Document {
      "metadata": {
        "blobType": "application/jsonl+json",
        "line": 2,
        "source": "blob",
      },
      "pageContent": "This is another sentence.",
    }
  `);
});
