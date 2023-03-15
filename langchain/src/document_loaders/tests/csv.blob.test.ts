import url from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { test, expect } from "@jest/globals";
import { CSVLoader } from "../csv.js";
import { Document } from "../../document.js";

test("Test CSV loader from blob", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
  );
  const loader = new CSVLoader(
    new Blob([await fs.readFile(filePath)], { type: "text/csv" }),
    "html"
  );
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: "blob", blobType: "text/csv", line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: "blob", blobType: "text/csv", line: 2 },
      pageContent: "<i>Reunited, Rush Clovis and Senator Amidala</i>",
    })
  );
});
