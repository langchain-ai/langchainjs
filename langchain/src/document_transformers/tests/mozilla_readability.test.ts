import { expect, test } from "@jest/globals";

import { Document } from "../../document.js";
import { MozillaReadabilityTransformer } from "../mozilla_readability.js";

test("Test HTML to text transformer", async () => {
  const webpageText = `<!DOCTYPE html>
<html>
  <head>
    <title>🦜️🔗 LangChain</title>
    <style>
      body {
        font-family: Arial, sans-serif;
      }
      h1 {
        color: darkblue;
      }
    </style>
  </head>
  <body>
    <div>
      <h1>🦜️🔗 LangChain</h1>
      <p>⚡ Building applications with LLMs through composability ⚡</p>
    </div>
    <div>
      As an open source project in a rapidly developing field, we are extremely open to contributions.
    </div>
  </body>
</html>`;
  const documents = [
    new Document({
      pageContent: webpageText,
    }),
    new Document({
      pageContent: "<div>Mitochondria is the powerhouse of the cell.</div>",
      metadata: { reliable: false },
    }),
  ];
  const transformer = new MozillaReadabilityTransformer();
  const newDocuments = await transformer.transformDocuments(documents);
  expect(newDocuments.length).toBe(2);
  expect(newDocuments[0].pageContent.length).toBeLessThan(webpageText.length);
  expect(newDocuments[1].pageContent).toBe(
    "Mitochondria is the powerhouse of the cell."
  );
  expect(newDocuments[1].metadata).toEqual({ reliable: false });
});
