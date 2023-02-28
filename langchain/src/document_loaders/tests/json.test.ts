import url from "url";
import path from "path";
import { test } from "@jest/globals";
import { JSONLoader } from "../json.js";

test("Test JSON loader", async () => {
  const loader = new JSONLoader(
    path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
    )
  );
  await loader.load();
});
