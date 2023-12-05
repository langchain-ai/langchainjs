import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import { ObsidianLoader } from "../fs/obsidian.js";
import { Document } from "../../document.js";

const STANDARD_METADATA_FIELDS = [
  "created",
  "path",
  "source",
  "lastAccessed",
  "lastModified",
];

const FRONTMATTER_FIELDS = [
  "aBool",
  "aFloat",
  "anInt",
  "anArray",
  "aString",
  "aDict",
  "tags",
];

const DATAVIEW_FIELDS = ["dataview1", "dataview2", "dataview3"];

const directoryPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "./example_data/obsidian"
);

let docs: Document[];

beforeAll(async () => {
  const loader = new ObsidianLoader(directoryPath);
  docs = await loader.load();
});

test("Test page content is loaded", async () => {
  expect(docs.length).toBe(5);
  docs.forEach((doc) => {
    expect(doc.pageContent).toBeTruthy();
  });
});

test("Test no additional metadata is collected if collectMetadata is false", async () => {
  const noMetadataLoader = new ObsidianLoader(directoryPath, {
    collectMetadata: false,
  });
  const noMetadataDocs = await noMetadataLoader.load();

  expect(noMetadataDocs.length).toBe(5);
  expect(
    noMetadataDocs.every(
      (doc) =>
        Object.keys(doc.metadata).length ===
          Object.keys(STANDARD_METADATA_FIELDS).length &&
        Object.keys(doc.metadata).every((key) =>
          STANDARD_METADATA_FIELDS.includes(key)
        )
    )
  ).toBe(true);
});

test("Test docs without frontmatter still have basic metadata", async () => {
  const doc = docs.find((doc) => doc.metadata.source === "no_metadata.md");

  if (!doc) {
    fail("'no_metadata.md' not found.");
  }

  expect(
    Object.keys(doc.metadata).every((key) =>
      STANDARD_METADATA_FIELDS.includes(key)
    )
  ).toBe(true);
});

test("Test standard frontmatter fields are loaded", async () => {
  const doc = docs.find((doc) => doc.metadata.source === "frontmatter.md");

  if (!doc) {
    fail("'frontmatter.md' not found.");
  }

  expect(Object.keys(doc.metadata)).toEqual(
    expect.arrayContaining(STANDARD_METADATA_FIELDS.concat("tags"))
  );

  const tagsSet = new Set(doc.metadata.tags?.split(","));
  expect(tagsSet.has("journal/entry")).toBe(true);
  expect(tagsSet.has("obsidian")).toBe(true);
});

test("Test a doc with non-yaml frontmatter still have basic metadata", async () => {
  const doc = docs.find((doc) => doc.metadata.source === "bad_frontmatter.md");

  if (!doc) {
    fail("'bad_frontmatter.md' not found.");
  }

  expect(
    Object.keys(doc.metadata).every((key) =>
      STANDARD_METADATA_FIELDS.includes(key)
    )
  ).toBe(true);
});

test("Test a doc with frontmatter and tags/dataview tags are all added to metadata", () => {
  const doc = docs.find(
    (doc) => doc.metadata.source === "tags_and_frontmatter.md"
  );

  if (!doc) {
    fail("'tags_and_frontmatter.md' not found.");
  }

  const expectedFields = [
    ...STANDARD_METADATA_FIELDS,
    ...FRONTMATTER_FIELDS,
    ...DATAVIEW_FIELDS,
  ];
  expect(Object.keys(doc.metadata)).toEqual(
    expect.arrayContaining(expectedFields)
  );
});

test("Test float metadata is loaded correctly", () => {
  const doc = docs.find(
    (doc) => doc.metadata.source === "tags_and_frontmatter.md"
  );

  if (!doc) {
    fail("Document 'tags_and_frontmatter.md' not found.");
    return;
  }

  expect(doc.metadata.aFloat).toBe(13.12345);
});

test("Test int metadata is loaded correctly", () => {
  const doc = docs.find(
    (doc) => doc.metadata.source === "tags_and_frontmatter.md"
  );

  if (!doc) {
    fail("Document 'tags_and_frontmatter.md' not found.");
    return;
  }

  expect(doc.metadata.anInt).toBe(15);
});

test("Test string metadata is loaded correctly", () => {
  const doc = docs.find(
    (doc) => doc.metadata.source === "tags_and_frontmatter.md"
  );

  if (!doc) {
    fail("Document 'tags_and_frontmatter.md' not found.");
    return;
  }

  expect(doc.metadata.aString).toBe("string value");
});

test("Test array metadata is loaded as a string", () => {
  const doc = docs.find(
    (doc) => doc.metadata.source === "tags_and_frontmatter.md"
  );

  if (!doc) {
    fail("Document 'tags_and_frontmatter.md' not found.");
    return;
  }

  expect(doc.metadata.anArray).toBe('["one","two","three"]');
});

test("Test dict metadata is stored as a string", () => {
  const doc = docs.find(
    (doc) => doc.metadata.source === "tags_and_frontmatter.md"
  );

  if (!doc) {
    fail("Document 'tags_and_frontmatter.md' not found.");
    return;
  }

  expect(doc.metadata.aDict).toBe('{"dictId1":"58417","dictId2":1500}');
});
