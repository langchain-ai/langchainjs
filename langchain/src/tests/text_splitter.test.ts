import { test, expect } from "@jest/globals";
import { Document } from "../document.js";
import {
  CharacterTextSplitter,
  MarkdownTextSplitter,
  RecursiveCharacterTextSplitter,
  TokenTextSplitter,
} from "../text_splitter.js";

test("Test splitting by character count.", async () => {
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 7,
    chunkOverlap: 3,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo bar", "bar baz", "baz 123"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count doesn't create empty documents.", async () => {
  const text = "foo  bar";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 2,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo", "bar"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count on long words.", async () => {
  const text = "foo bar baz a a";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 1,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo", "bar", "baz", "a a"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by character count when shorter words are first.", async () => {
  const text = "a a foo bar baz";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 1,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["a a", "foo", "bar", "baz"];
  expect(output).toEqual(expectedOutput);
});

test("Test splitting by characters when splits not found easily.", async () => {
  const text = "foo bar baz 123";
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 1,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo", "bar", "baz", "123"];
  expect(output).toEqual(expectedOutput);
});

test("Test invalid arguments.", () => {
  expect(() => {
    const res = new CharacterTextSplitter({ chunkSize: 2, chunkOverlap: 4 });
    console.log(res);
  }).toThrow();
});

test("Test create documents method.", async () => {
  const texts = ["foo bar", "baz"];
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments(texts);
  const metadata = { loc: { lines: { from: 1, to: 1 } } };
  const expectedDocs = [
    new Document({ pageContent: "foo", metadata }),
    new Document({ pageContent: "bar", metadata }),
    new Document({ pageContent: "baz", metadata }),
  ];
  expect(docs).toEqual(expectedDocs);
});

test("Test create documents with metadata method.", async () => {
  const texts = ["foo bar", "baz"];
  const splitter = new CharacterTextSplitter({
    separator: " ",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const docs = await splitter.createDocuments(texts, [
    { source: "1" },
    { source: "2" },
  ]);
  const loc = { lines: { from: 1, to: 1 } };
  const expectedDocs = [
    new Document({ pageContent: "foo", metadata: { source: "1", loc } }),
    new Document({
      pageContent: "bar",
      metadata: { source: "1", loc },
    }),
    new Document({ pageContent: "baz", metadata: { source: "2", loc } }),
  ];
  expect(docs).toEqual(expectedDocs);
});

test("Test iterative text splitter.", async () => {
  const text = `Hi.\n\nI'm Harrison.\n\nHow? Are? You?\nOkay then f f f f.
This is a weird text to write, but gotta test the splittingggg some how.\n\n
Bye!\n\n-H.`;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 10,
    chunkOverlap: 1,
  });
  const output = await splitter.splitText(text);
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

test("Token text splitter", async () => {
  const text = "foo bar baz a a";
  const splitter = new TokenTextSplitter({
    encodingName: "r50k_base",
    chunkSize: 3,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = ["foo bar b", "az a a"];

  expect(output).toEqual(expectedOutput);
});

test("Test markdown text splitter.", async () => {
  const text =
    "# 🦜️🔗 LangChain\n" +
    "\n" +
    "⚡ Building applications with LLMs through composability ⚡\n" +
    "\n" +
    "## Quick Install\n" +
    "\n" +
    "```bash\n" +
    "# Hopefully this code block isn't split\n" +
    "pip install langchain\n" +
    "```\n" +
    "\n" +
    "As an open source project in a rapidly developing field, we are extremely open to contributions.";
  const splitter = new MarkdownTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
  });
  const output = await splitter.splitText(text);
  const expectedOutput = [
    "# 🦜️🔗 LangChain\n\n⚡ Building applications with LLMs through composability ⚡",
    "Quick Install\n\n```bash\n# Hopefully this code block isn't split\npip install langchain",
    "As an open source project in a rapidly developing field, we are extremely open to contributions.",
  ];
  expect(output).toEqual(expectedOutput);
});

test("Test lines loc on iterative text splitter.", async () => {
  const text = `Hi.\nI'm Harrison.\n\nHow?\na\nb`;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 20,
    chunkOverlap: 1,
  });
  const docs = await splitter.createDocuments([text]);

  const expectedDocs = [
    new Document({
      pageContent: "Hi.\nI'm Harrison.",
      metadata: { loc: { lines: { from: 1, to: 2 } } },
    }),
    new Document({
      pageContent: "How?\na\nb",
      metadata: { loc: { lines: { from: 4, to: 6 } } },
    }),
  ];

  expect(docs).toEqual(expectedDocs);
});
