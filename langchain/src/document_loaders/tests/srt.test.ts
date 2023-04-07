import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { SRTLoader } from "../path/srt.js";

test("Test SRT loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.srt"
  );
  const loader = new SRTLoader(filePath);
  const docs = await loader.load();
  expect(docs.length).toBe(1);
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "source": "${filePath}",
    }
  `);
  expect(docs[0].pageContent).toContain("Corruption discovered");
});
