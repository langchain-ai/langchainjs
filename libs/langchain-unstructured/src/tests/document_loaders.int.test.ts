import { test, jest, expect } from "@jest/globals";
import * as fs from "node:fs";
import { UnstructuredLoader } from "../document_loaders.js";

const TXT_PATH = "./src/tests/data/test.txt";
const TXT_FILE_NAME = "test.txt";
const MD_PATH = "./src/tests/data/test.md";
const MD_FILE_NAME = "test.md";
const PDF_PATH = "./src/tests/data/test.pdf";
const PDF_FILE_NAME = "test.pdf";

test("can load a .txt file", async () => {
  const loader = new UnstructuredLoader({
    filePath: TXT_PATH,
  });
  const documents = await loader.load();

  expect(documents).toHaveLength(1);
  expect(documents[0].pageContent).toBe("this is a test text document!");
  expect(documents[0].metadata.filename).toBe(TXT_FILE_NAME);
});

test("can load a list of .txt files", async () => {
  const loader = new UnstructuredLoader({
    filePath: [TXT_PATH, TXT_PATH],
  });

  const documents = await loader.load();

  expect(documents).toHaveLength(2);

  expect(documents[0].pageContent).toBe("this is a test text document!");
  expect(documents[0].metadata.filename).toBe(TXT_FILE_NAME);

  expect(documents[1].pageContent).toBe("this is a test text document!");
  expect(documents[1].metadata.filename).toBe(TXT_FILE_NAME);
});

test("can process a .txt file buffer", async () => {
  const txtFileBuffer = await fs.promises.readFile(TXT_PATH);
  const loader = new UnstructuredLoader({
    buffer: txtFileBuffer,
    fileName: TXT_FILE_NAME,
  });

  const documents = await loader.load();
  console.dir(documents, { depth: null });
  expect(documents).toHaveLength(1);

  expect(documents[0].pageContent).toBe("this is a test text document!");
  expect(documents[0].metadata.filename).toBe(TXT_FILE_NAME);
});

test("can load a .md file", async () => {
  const loader = new UnstructuredLoader({
    filePath: MD_PATH,
  });
  const documents = await loader.load();

  expect(documents).toHaveLength(1);
  expect(documents[0].pageContent).toBe("this is a test text document!");
  expect(documents[0].metadata.filename).toBe(MD_FILE_NAME);
});

test("can load a list of .md files", async () => {
  const loader = new UnstructuredLoader({
    filePath: [MD_PATH, MD_PATH],
  });

  const documents = await loader.load();

  expect(documents).toHaveLength(2);

  expect(documents[0].pageContent).toBe("this is a test text document!");
  expect(documents[0].metadata.filename).toBe(MD_FILE_NAME);

  expect(documents[1].pageContent).toBe("this is a test text document!");
  expect(documents[1].metadata.filename).toBe(MD_FILE_NAME);
});

test("can process a .md file buffer", async () => {
  const mdFileBuffer = await fs.promises.readFile(MD_PATH);
  const loader = new UnstructuredLoader({
    buffer: mdFileBuffer,
    fileName: MD_FILE_NAME,
  });

  const documents = await loader.load();

  expect(documents).toHaveLength(1);

  expect(documents[0].pageContent).toBe("this is a test text document!");
  expect(documents[0].metadata.filename).toBe(MD_FILE_NAME);
});

test("can load a .pdf file", async () => {
  const loader = new UnstructuredLoader({
    filePath: PDF_PATH,
  });
  const documents = await loader.load();
  console.dir(documents, { depth: null });
  expect(documents).toHaveLength(1);
  expect(documents[0].pageContent).toBe(
    "This is a test PDF for the UnstructuredDocumentLoader"
  );
  expect(documents[0].metadata.filename).toBe(PDF_FILE_NAME);
});

test("can load a list of .pdf files", async () => {
  const loader = new UnstructuredLoader({
    filePath: [PDF_PATH, PDF_PATH],
  });

  const documents = await loader.load();

  expect(documents).toHaveLength(2);

  expect(documents[0].pageContent).toBe(
    "This is a test PDF for the UnstructuredDocumentLoader"
  );
  expect(documents[0].metadata.filename).toBe(PDF_FILE_NAME);

  expect(documents[1].pageContent).toBe(
    "This is a test PDF for the UnstructuredDocumentLoader"
  );
  expect(documents[1].metadata.filename).toBe(PDF_FILE_NAME);
});

test("can process a .pdf file buffer", async () => {
  const pdfFileBuffer = await fs.promises.readFile(PDF_PATH);
  const loader = new UnstructuredLoader({
    buffer: pdfFileBuffer,
    fileName: PDF_FILE_NAME,
  });

  const documents = await loader.load();

  expect(documents).toHaveLength(1);

  expect(documents[0].pageContent).toBe(
    "This is a test PDF for the UnstructuredDocumentLoader"
  );
  expect(documents[0].metadata.filename).toBe(PDF_FILE_NAME);
});

test("enableLogs true includes sdk console.info calls", async () => {
  const loader = new UnstructuredLoader(
    {
      filePath: TXT_PATH,
    },
    {
      enableLogs: true,
    }
  );
  // Mock the console.info function
  const mockInfo = jest.fn();
  console.info = mockInfo;

  await loader.load();

  expect(mockInfo).toHaveBeenCalled();
});

test("enableLogs false overrides sdk console.info calls", async () => {
  const loader = new UnstructuredLoader(
    {
      filePath: TXT_PATH,
    },
    {
      enableLogs: false,
    }
  );
  // Mock the console.info function
  const mockInfo = jest.fn();
  console.info = mockInfo;

  await loader.load();

  expect(mockInfo).not.toHaveBeenCalled();
});

// Skipping because this test loads a rather large doc which takes a while.
test.skip("Test Unstructured base loader with extractImageBlockTypes", async () => {
  const options = {
    extractImageBlockTypes: ["image"],
    splitPdfConcurrencyLevel: 15,
  };

  const loader = new UnstructuredLoader(
    {
      filePath: "src/tests/data/1706.03762.pdf",
    },
    options
  );
  const docs = await loader.load();

  expect(docs.length).toBeGreaterThan(10);
  expect(
    docs.some((item) => item?.metadata?.category.toLowerCase() === "image")
  ).toBe(true);
});

/**
 * TODO @brace implement once `DirectoryLoader` is moved to core.
 */

// Skipping because this test loads all files in the data directory which takes a while.
// test.skip("Test Unstructured directory loader", async () => {
//   const directoryPath = path.resolve(
//     path.dirname(url.fileURLToPath(import.meta.url)),
//     "src/tests/data"
//   );

//   const options = {
//     apiKey: process.env.UNSTRUCTURED_API_KEY!,
//     strategy: "fast",
//   };

//   const loader = new UnstructuredDirectoryLoader(
//     directoryPath,
//     options,
//     true,
//     UnknownHandling.Ignore
//   );
//   const docs = await loader.load();

//   expect(docs.length).toBeGreaterThan(100);
//   expect(typeof docs[0].pageContent).toBe("string");
// });
