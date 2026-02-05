import { test, expect } from "vitest";
import { Document } from "../documents/document.js";

test("Document should handle empty pageContent", () => {
  const doc = new Document({ pageContent: "" });
  expect(doc.pageContent).toEqual("");
});
