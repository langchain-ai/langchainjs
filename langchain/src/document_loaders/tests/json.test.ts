import { test } from "@jest/globals";
import { JSONLoader } from "../json.js";

test("Test Text loader", async () => {
  const loader = new JSONLoader(
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl",
    "/html"
  );
  await loader.load();
});
