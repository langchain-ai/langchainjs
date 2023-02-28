import url from "url";
import path from "path";
import { test, expect } from "@jest/globals";
import { CSVLoader } from "../csv.js";
import { Document } from "../../document.js";

test("Test CSV loader", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
  );
  const loader = new CSVLoader(filePath, "html");
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});
