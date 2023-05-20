import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import {
  getSourceNameFromDocument,
  getSourceTypeFromDocument,
  getUniqueIDFromDocument,
} from "../document_utils.js";

test("should get the right SourceName and SourceType", () => {
  const doc = {
    pageContent: "hello",
    metadata: { a: 1 },
    sourceName: "hello.txt",
    sourceType: "file",
  };

  expect(getSourceNameFromDocument(doc)).toBe("hello.txt");
  expect(getSourceTypeFromDocument(doc)).toBe("file");

  const doc2 = {
    pageContent: "hello",
    metadata: { a: 1, sourceName: "hello.txt", sourceType: "file" },
  };

  expect(getSourceNameFromDocument(doc2)).toBe("hello.txt");
  expect(getSourceTypeFromDocument(doc)).toBe("file");

  const doc3 = { pageContent: "hello", metadata: { a: 1 } };

  expect(getSourceNameFromDocument(doc3).length).toBe(36);
  expect(getSourceTypeFromDocument(doc3)).toBe("unknown");
});

test("should generate a unique id with given sourceType and sourceName", () => {
  const doc: Document = {
    metadata: {
      loc: {
        lines: {
          from: 10,
          to: 20,
        },
      },
      source: "mySource",
    },
    pageContent: "myPageContent",
    sourceType: "mySourceType",
    sourceName: "mySourceName",
  };

  const result = getUniqueIDFromDocument(doc);
  expect(result).toBe("mySourceType:mySourceName:10-20");
});

test("should use metadata source if sourceName is not present", () => {
  const doc: Document = {
    metadata: {
      loc: {
        lines: {
          from: 30,
          to: 40,
        },
      },
      sourceName: "metaSourceName",
    },
    pageContent: "myPageContent",
    sourceType: "metaSourceType",
  };

  const result = getUniqueIDFromDocument(doc);
  expect(result).toBe("metaSourceType:metaSourceName:30-40");
});

test("should generate a unique id with a random uuid if sourceName and metadata source are not present", () => {
  const doc: Document = {
    metadata: {
      loc: {
        lines: {
          from: 50,
          to: 60,
        },
      },
    },
    pageContent: "myPageContent",
    sourceType: "unknownSourceType",
  };

  const result = getUniqueIDFromDocument(doc);
  expect(result.length).toBe(60);
});

test('should use "1-1" as default loc if it is not present', () => {
  const doc: Document = {
    metadata: {},
    sourceType: "defaultSourceType",
    sourceName: "defaultSourceName",
    pageContent: "myPageContent",
  };

  const result = getUniqueIDFromDocument(doc);
  expect(result).toBe("defaultSourceType:defaultSourceName:1-1");
});
