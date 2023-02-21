import { test } from "@jest/globals";
import { TextLoader } from "../text";

test("Test Text loader", async () => {
  const loader = new TextLoader(
    "src/document_loaders/example_data/example.txt"
  );
  const docs = await loader.load();
  console.log({ docs });
});
