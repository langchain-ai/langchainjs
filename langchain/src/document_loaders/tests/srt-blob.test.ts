import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { test, expect } from "@jest/globals";
import { SRTLoader } from "../path/srt.js";

test("Test SRT loader from blob", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.srt"
  );
  const loader = new SRTLoader(
    new Blob([await fs.readFile(filePath)], { type: "application/x-subrip" })
  );
  const docs = await loader.load();
  expect(docs.length).toBe(1);
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "blobType": "application/x-subrip",
      "source": "blob",
    }
  `);
  expect(docs[0].pageContent).toContain("Corruption discovered");
});
