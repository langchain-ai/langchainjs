import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { MarkdownLoader } from "../fs/md.js";
import { Document } from "../../document.js";

test("Test MarkdownLoader from file with default options", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example.md"
  );
  const loader = new MarkdownLoader(filePath);
  const docs = await loader.load();
  expect(docs.length).toBe(3);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1, section: 1 },
      pageContent: `# Section 1

This is the first section.`,
    })
  );
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: filePath, line: 2, section: 2 },
      pageContent: `## Section 2

This is the second section.

### Subsection 2.1

This is the first subsection of the second section.`,
    })
  );
});

test("Test MarkdownLoader from file without splitting sections", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example.md"
  );
  const loader = new MarkdownLoader(filePath, { splitSection: false });
  const docs = await loader.load();
  expect(docs.length).toBe(1);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, section: 1 },
      pageContent: `# Section 1

This is the first section.

## Section 2

This is the second section.

### Subsection 2.1

This is the first subsection of the second section.

## Section 3

This is the third section.

### Subsection 3.1

This is the first subsection of the third section.`,
    })
  );
});

test("Test MarkdownLoader from file changing the headerDepth", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/example.md"
  );
  const loader = new MarkdownLoader(filePath, { headerDepth: 3 });
  const docs = await loader.load();
  expect(docs.length).toBe(5);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1, section: 1 },
      pageContent: `# Section 1

This is the first section.`,
    })
  );
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: filePath, line: 2, section: 2 },
      pageContent: `## Section 2

This is the second section.`,
    })
  );

  expect(docs[2]).toEqual(
    new Document({
      metadata: { source: filePath, line: 3, section: 3 },
      pageContent: `### Subsection 2.1

This is the first subsection of the second section.`,
    })
  );
});
