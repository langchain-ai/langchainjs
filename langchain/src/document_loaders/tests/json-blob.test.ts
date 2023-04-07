import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { test, expect } from "@jest/globals";
import { JSONLoader } from "../path/json.js";
import { Document } from "../../document.js";

test("Test JSON loader from blob", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
  );
  const loader = new JSONLoader(
    new Blob([await fs.readFile(filePath)], { type: "application/json" })
  );
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: "blob", blobType: "application/json", line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});

test("Test JSON loader from blob", async () => {
  const loader = new JSONLoader(
    new Blob(
      [
        `{
  "texts": ["This is a sentence.", "This is another sentence."]
}`,
      ],
      { type: "application/json" }
    )
  );
  const docs = await loader.load();
  expect(docs.length).toBe(2);
  expect(docs[0]).toMatchInlineSnapshot(`
    Document {
      "metadata": {
        "blobType": "application/json",
        "line": 1,
        "source": "blob",
      },
      "pageContent": "This is a sentence.",
    }
  `);
  expect(docs[1]).toMatchInlineSnapshot(`
    Document {
      "metadata": {
        "blobType": "application/json",
        "line": 2,
        "source": "blob",
      },
      "pageContent": "This is another sentence.",
    }
  `);
});

test("Test JSON loader from blob", async () => {
  const loader = new JSONLoader(
    new Blob(
      [
        `{
  "1": {
    "body": "BD 2023 SUMMER",
    "from": "LinkedIn Job",
    "labels": ["IMPORTANT", "CATEGORY_UPDATES", "INBOX"]
  },
  "2": {
    "body": "Intern, Treasury and other roles are available",
    "from": "LinkedIn Job2",
    "labels": ["IMPORTANT"],
    "other": {
      "name": "plop",
      "surname": "bob"
    }
  }
}`,
      ],
      { type: "application/json" }
    )
  );
  const docs = await loader.load();
  expect(docs.length).toBe(10);
  expect(docs[0]).toMatchInlineSnapshot(`
    Document {
      "metadata": {
        "blobType": "application/json",
        "line": 1,
        "source": "blob",
      },
      "pageContent": "BD 2023 SUMMER",
    }
  `);
  expect(docs[1]).toMatchInlineSnapshot(`
    Document {
      "metadata": {
        "blobType": "application/json",
        "line": 2,
        "source": "blob",
      },
      "pageContent": "LinkedIn Job",
    }
  `);
});
