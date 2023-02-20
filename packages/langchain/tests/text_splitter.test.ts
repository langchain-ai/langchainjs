import { test, expect } from "@jest/globals";
import { Document } from "../document";
import {
  CharacterTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "../text_splitter";

test("Test splitting by character count.", () => {
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 7,
    chunkOverlap: 3,
  });
  const output = splitter.splitText(text);
  const expectedOutput = ["foo bar", "bar baz", "baz 123"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count doesn't create empty documents.", () => {
  const text = "foo  bar";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 2,
    chunkOverlap: 0,
  });
  const output = splitter.splitText(text);
  const expectedOutput = ["foo", "bar"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count on long words.", () => {
  const text = "foo bar baz a a";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 1,
  });
  const output = splitter.splitText(text);
  const expectedOutput = ["foo", "bar", "baz", "a a"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count when shorter words are first.", () => {
  const text = "a a foo bar baz";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 1,
  });
  const output = splitter.splitText(text);
  const expectedOutput = ["a a", "foo", "bar", "baz"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by characters when splits not found easily.", () => {
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 1,
    chunkOverlap: 0,
  });
  const output = splitter.splitText(text);
  const expectedOutput = ["foo", "bar", "baz", "123"];
  expect(output).toEqual(expectedOutput);
});

test("Test invalid arguments.", () => {
  expect(() => {
    const res = new CharacterTextSplitter({ chunkSize: 2, chunkOverlap: 4 });
    console.log(res);
  }).toThrow();
});

test("Test create documents method.", () => {
  const texts = ["foo bar", "baz"];
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const docs = splitter.createDocuments(texts);
  const expectedDocs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
    new Document({ pageContent: "baz" }),
  ];
  expect(docs).toEqual(expectedDocs);
});

test("Test create documents with metadata method.", () => {
  const texts = ["foo bar", "baz"];
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const docs = splitter.createDocuments(texts, [
    { source: "1" },
    { source: "2" },
  ]);
  const expectedDocs = [
    new Document({ pageContent: "foo", metadata: { source: "1" } }),
    new Document({ pageContent: "bar", metadata: { source: "1" } }),
    new Document({ pageContent: "baz", metadata: { source: "2" } }),
  ];
  expect(docs).toEqual(expectedDocs);
});

test("Test iterative text splitter.", () => {
  const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.
This is a weird text to write, but gotta test the splittingggg some how.\n\n
Bye!\n\n-H.`;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 1,
  });
  const output = splitter.splitText(text);
  const expectedOutput = [
    "Hi.",
    "I'm",
    "Harrison.",
    "How? Are?",
    "You?",
    "Okay then f",
    "f f f f.",
    "This is a",
    "a weird",
    "text to",
    "write, but",
    "gotta test",
    "the",
    "splitting",
    "gggg",
    "some how.",
    "Bye!\n\n-H.",
  ];
  expect(output).toEqual(expectedOutput);
});

test("Token text splitter", () => {
  const text = "foo bar baz a a";
  const splitter = new TokenTextSplitter({
    encodingName: "r50k_base",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const output = splitter.splitText(text);
  const expectedOutput = ["foo bar b", "az a a"];

  expect(output).toEqual(expectedOutput);
});
