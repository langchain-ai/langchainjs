import { test, expect } from "@jest/globals";
import * as url from "node:url";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { PDFLoader } from "../path/pdf.js";

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

  expect(docs.length).toBe(15);
  expect(docs[0].pageContent).toContain("Attention Is All You Need");
  expect(docs[0].metadata).toMatchInlineSnapshot(`
    {
      "blobType": "application/pdf",
      "loc": {
        "pageNumber": 1,
      },
      "pdf": {
        "info": {
          "Author": "",
          "CreationDate": "D:20171207010315Z",
          "Creator": "LaTeX with hyperref package",
          "Custom": {
            "PTEX.Fullbanner": "This is pdfTeX, Version 3.14159265-2.6-1.40.17 (TeX Live 2016) kpathsea version 6.2.2",
          },
          "EncryptFilterName": null,
          "IsAcroFormPresent": false,
          "IsCollectionPresent": false,
          "IsLinearized": false,
          "IsSignaturesPresent": false,
          "IsXFAPresent": false,
          "Keywords": "",
          "Language": null,
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
        "version": "3.4.120",
      },
      "source": "blob",
    }
  `);
});
