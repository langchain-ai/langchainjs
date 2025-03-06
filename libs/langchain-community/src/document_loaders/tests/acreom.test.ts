import path from "path";
import { fileURLToPath } from "url";
import { AcreomFileLoader } from "../fs/acreom.js";

// Resolve the test data path relative to this file
const testDataPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "example_data/acreom"
);

describe("AcreomFileLoader", () => {
  const encoding = "utf8" as BufferEncoding;

  it("should parse metadata and content correctly from frontmatter.md", async () => {
    const filePath = path.join(testDataPath, "frontmatter.md");
    const loader = new AcreomFileLoader(filePath, { encoding });
    const documents = await loader.load();

    const document = documents[0];

    expect(document).toBeDefined();
    expect(document.metadata).toMatchObject({
      source: "frontmatter.md",
      path: filePath,
      title: "Correct Title",
      tags: "Tag1, Tag2",
      author: "Test Author",
    });

    expect(document.pageContent.trim()).toBe(
      "This is the content of the file with correct front matter."
    );
  });

  it("should handle no front matter in no_frontmatter.md gracefully", async () => {
    const filePath = path.join(testDataPath, "no_frontmatter.md");
    const loader = new AcreomFileLoader(filePath, { encoding });
    const documents = await loader.load();

    const document = documents[0];

    expect(document).toBeDefined();
    expect(document.metadata).toMatchObject({
      source: "no_frontmatter.md",
      path: filePath,
    });

    expect(document.pageContent.trim()).toBe(
      "This content does not have front matter. Only plain text."
    );
  });

  it("should handle bad front matter in bad_frontmatter.md gracefully", async () => {
    const filePath = path.join(testDataPath, "bad_frontmatter.md");
    const loader = new AcreomFileLoader(filePath, { encoding });
    const documents = await loader.load();

    const document = documents[0];

    expect(document).toBeDefined();
    expect(document.metadata).toMatchObject({
      source: "bad_frontmatter.md",
      path: filePath,
    });

    expect(document.pageContent.trim()).toBe(
      "This is the content of the file with bad front matter."
    );
  });

  it("should ignore tasks, hashtags, and doclinks in frontmatter.md", async () => {
    const filePath = path.join(testDataPath, "frontmatter.md");
    const loader = new AcreomFileLoader(filePath, { encoding });
    const documents = await loader.load();

    const document = documents[0];

    expect(document).toBeDefined();

    // Ensure tasks, hashtags, and doclinks are removed from the content
    expect(document.pageContent).not.toContain("[ ]");
    expect(document.pageContent).not.toContain("#");
    expect(document.pageContent).not.toContain("[[");
  });
});
