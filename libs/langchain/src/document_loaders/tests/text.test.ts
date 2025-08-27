import url from "node:url";
import path from "node:path";

import { test, expect } from "vitest";

import { TextLoader } from "../fs/text.js";

test("Test Text loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example.txt"
  );
  const loader = new TextLoader(filePath);
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
      "source": "${filePath}",
    }
  `);
});
