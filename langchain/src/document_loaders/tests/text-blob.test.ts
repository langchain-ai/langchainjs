import { test, expect } from "@jest/globals";
import { TextLoader } from "../path/text.js";

test("Test Text loader from blob", async () => {
  const loader = new TextLoader(
    new Blob(["Hello, world!"], { type: "text/plain" })
  );
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toBe("Hello, world!");
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "blobType": "text/plain",
      "source": "blob",
    }
  `);
});
