import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { CSVLoader } from "../path/csv.js";
import { Document } from "../../document.js";

test("Test CSV loader from file with column arg", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
  );
  const loader = new CSVLoader(filePath, "html");
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: filePath, line: 2 },
      pageContent: "<i>Reunited, Rush Clovis and Senator Amidala</i>",
    })
  );
});

test("Test CSV loader without column arg", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
  );
  const loader = new CSVLoader(filePath);
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1 },
      pageContent: `id: 1
html: <i>Corruption discovered at the core of the Banking Clan!</i>`,
    })
  );
});
