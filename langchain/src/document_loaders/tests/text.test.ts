import { test, expect } from "@jest/globals";
import { TextLoader } from "../path/text.js";

test("Test Text loader from file", async () => {
  const loader = new TextLoader(
    "../examples/src/document_loaders/example_data/example.txt"
  );
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toMatchInlineSnapshot(`
    "Foo
    Bar
    Baz

    "
  `);
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "source": "../examples/src/document_loaders/example_data/example.txt",
    }
  `);
});
