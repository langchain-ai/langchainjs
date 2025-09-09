import { Document } from "@langchain/core/documents";

export const TEXTS = ["foo", "bar", "baz", "bak", "cat"];
export const METADATAS = [
  { start: 0, end: 100, quality: "good", ready: true },
  { start: 100, end: 200, quality: "bad", ready: false },
  { start: 200, end: 300, quality: "ugly", ready: true },
  { start: 200, quality: "ugly", ready: true, Owner: "Steve" },
  { start: 300, quality: "ugly", Owner: "Steve" },
];
export const DOCUMENTS = TEXTS.map(
  (text, index) =>
    new Document({ pageContent: text, metadata: METADATAS[index] })
);
export const TABLE_NAME = "TEST_TABLE";
