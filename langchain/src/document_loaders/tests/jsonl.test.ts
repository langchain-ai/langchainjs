import url from "url";
import path from "path";
import { test } from "@jest/globals";
import { JSONLinesLoader } from "../jsonl.js";

test("Test JSON loader", async () => {
  const loader = new JSONLinesLoader(
    path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl"
    ),
    "/html"
  );
  await loader.load();
});
