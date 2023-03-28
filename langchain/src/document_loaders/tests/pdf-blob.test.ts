import { test, expect } from "@jest/globals";
import url from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import { PDFLoader } from "../pdf.js";

test("Test PDF loader from blob", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );
  const loader = new PDFLoader(
    new Blob([await fs.readFile(filePath)], {
      type: "application/pdf",
    })
  );
  const docs = await loader.load();

  expect(docs.length).toBe(1);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "blobType": "application/pdf",
      "pdf": {
        "info": {
          "Author": "",
          "CreationDate": "D:20171207010315Z",
          "Creator": "LaTeX with hyperref package",
          "IsAcroFormPresent": false,
          "IsXFAPresent": false,
          "Keywords": "",
          "ModDate": "D:20171207010315Z",
          "PDFFormatVersion": "1.5",
          "Producer": "pdfTeX-1.40.17",
          "Subject": "",
          "Title": "",
          "Trapped": {
            "name": "False",
          },
        },
        "metadata": null,
        "numpages": 15,
      },
      "source": "blob",
    }
  `);
});
