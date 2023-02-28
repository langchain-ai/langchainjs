import { test } from "@jest/globals";
import { TextLoader } from "../text.js";

test("Test Text loader", async () => {
  const loader = new TextLoader(
    "../examples/src/document_loaders/example_data/example.txt"
  );
  await loader.load();
});
