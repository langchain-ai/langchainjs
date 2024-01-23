import { it, expect } from "@jest/globals";
import { SearchResult, TextContentsOptions } from "exa-js";
import { Document } from "@langchain/core/documents";
import { _getMetadata } from "../retrievers.js";

it("should exclude the text field from metadata", () => {
  const dummyResult: SearchResult<{ text: TextContentsOptions }> = {
    title: "title",
    url: "https://example.com",
    publishedDate: "01/01/2024",
    author: "me myself and i",
    score: 100,
    id: "very unique ID",
    text: "string!",
  };

  const metadata = _getMetadata(dummyResult);
  expect("text" in metadata).toBe(false);
});

test("can instanciate a document class", () => {
  const newDoc = new Document({
    pageContent: "This is a test",
    metadata: { test: true },
  });
  expect(newDoc).toBeTruthy();
  expect(newDoc.metadata.test).toBeTruthy();
  expect(newDoc.pageContent).toBe("This is a test");
});
