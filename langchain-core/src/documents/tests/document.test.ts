import { test, expect } from '@jest/globals';
import { Document } from '../document.js';

test("Document toString works with pageContent and metadata", () => {
  const document = new Document({
    pageContent: "Hello, world!",
    metadata: {
      foo: "bar",
    }
  })
  const documentAsString = `${document}`;
  expect(documentAsString).toBe("content: Hello, world!\nmetadata: {\"foo\":\"bar\"}");
});

test("Document toString works without metadata", () => {
  const document = new Document({
    pageContent: "Hello, world!",
  })
  const documentAsString = `${document}`;
  expect(documentAsString).toBe("content: Hello, world!");
});

test("Document toString works with an empty object for metadata", () => {
  const document = new Document({
    pageContent: "Hello, world!",
    metadata: {},
  })
  const documentAsString = `${document}`;
  expect(documentAsString).toBe("content: Hello, world!");
});