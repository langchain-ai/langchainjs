import url from "url";
import path from "path";
import { test, expect } from "@jest/globals";
import { DirectoryLoader, UnknownHandling } from "../directory.js";
import { CSVLoader } from "../csv.js";
import { PDFLoader } from "../pdf.js";
import { TextLoader } from "../text.js";
import { JSONLoader } from "../json.js";

test("Test Directory loader", async () => {
  const directoryPath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data"
  );
  const loader = new DirectoryLoader(
    directoryPath,
    {
      ".csv": (p) => new CSVLoader(p, "html"),
      ".pdf": (p) => new PDFLoader(p),
      ".txt": (p) => new TextLoader(p),
      ".json": (p) => new JSONLoader(p),
    },
    true,
    UnknownHandling.Ignore
  );
  const docs = await loader.load();
  expect(docs.length).toBe(66);
  expect(docs.map((d) => d.metadata.source).sort()).toEqual([
    // PDF
    path.resolve(directoryPath, "1706.03762.pdf"),
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
    // TXT
    path.resolve(directoryPath, "example.txt"),
  ]);
});
