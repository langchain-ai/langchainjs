import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { DirectoryLoader, UnknownHandling } from "../fs/directory.js";
import { CSVLoader } from "../fs/csv.js";
import { PDFLoader } from "../fs/pdf.js";
import { TextLoader } from "../fs/text.js";
import { JSONLoader } from "../fs/json.js";

test("Test Directory loader", async () => {
  const directoryPath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data"
  );
  const loader = new DirectoryLoader(
    directoryPath,
    {
      ".csv": (p) => {
        if (p.includes("separator.csv")) {
          return new CSVLoader(p, { column: "html", separator: "｜" });
        }
        return new CSVLoader(p, "html");
      },
      ".pdf": (p) => new PDFLoader(p),
      ".txt": (p) => new TextLoader(p),
      ".json": (p) => new JSONLoader(p),
    },
    false,
    UnknownHandling.Ignore
  );
  const docs = await loader.load();
  expect(docs.length).toBe(122);
  expect(docs.map((d) => d.metadata.source).sort()).toEqual([
    // PDF
    ...Array.from({ length: 15 }, (_) =>
      path.resolve(directoryPath, "1706.03762.pdf")
    ),
    // CSV
    ...Array.from({ length: 32 }, (_) =>
      path.resolve(
        directoryPath,
        "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
      )
    ),
    // JSON
    ...Array.from({ length: 32 }, (_) =>
      path.resolve(
        directoryPath,
        "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
      )
    ),
    ...Array.from({ length: 10 }, (_) =>
      path.resolve(directoryPath, "complex.json")
    ),
    // TXT
    path.resolve(directoryPath, "example.txt"),
    // CSV
    ...Array.from({ length: 32 }, (_) =>
      path.resolve(directoryPath, "example_separator.csv")
    ),
  ]);
});
