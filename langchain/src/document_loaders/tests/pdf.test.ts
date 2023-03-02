import { test, expect } from "@jest/globals";
import url from "url";
import path from "path";
import { PDFLoader } from "../pdf.js";

test("Test PDF loader", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
});
