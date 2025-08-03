import { test, expect } from "@jest/globals";
import { Document } from "../documents/document.js";

test("Document should handle empty pageContent", () => {
  const doc = new Document({ pageContent: "" });
  expect(doc.pageContent).toEqual("");
});
