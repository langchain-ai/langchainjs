import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { WebPDFLoader } from "../web/pdf.js";

test("Test Web PDF loader from blob", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/1706.03762.pdf"
  );
  const loader = new WebPDFLoader(
    new Blob([await fs.readFile(filePath)], {
      type: "application/pdf",
    })
  );
  const docs = await loader.load();

  expect(docs.length).toBe(15);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "loc": {
        "pageNumber": 1,
      },
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
        "totalPages": 15,
        "version": "1.10.100",
      },
    }
  `);
});
