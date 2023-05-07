import { test, expect } from "@jest/globals";
import { createRequire } from "module";
import fs from "fs/promises";
import * as url from "node:url";
import * as path from "node:path";
import { PdfWebBaseLoader } from "../web/pdf.js";

test("Test PDF loader from URL", async () => {
  const pdfUrl = "https://arxiv.org/pdf/1706.03762.pdf";
  const requireFunc = createRequire(import.meta.url);
  const workerSrc = requireFunc.resolve(
    "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js"
  );
  const loader = new PdfWebBaseLoader(pdfUrl, {
    workerSrc,
  });
  const docs = await loader.load();

  expect(docs.length).toBe(15);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});

test("Test PDF loader from URL to single document", async () => {
 const pdfUrl = "https://arxiv.org/pdf/1706.03762.pdf";
  const requireFunc = createRequire(import.meta.url);
  const workerSrc = requireFunc.resolve(
    "pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js"
  );
  const loader = new PdfWebBaseLoader(pdfUrl, {
    workerSrc,
    splitPages: false
  });
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});

test("Test PDF loader from Uint8Array", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );
  const pdfBuffer = await fs.readFile(filePath);
  const pdfArray = new Uint8Array(pdfBuffer.buffer);
  const loader = new PdfWebBaseLoader(pdfArray);
  const docs = await loader.load();

  expect(docs.length).toBe(15);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});

test("Test PDF loader from Uint8Array to single document", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );
  const pdfBuffer = await fs.readFile(filePath);
  const pdfArray = new Uint8Array(pdfBuffer.buffer);
  const loader = new PdfWebBaseLoader(pdfArray, { splitPages: false });
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});
