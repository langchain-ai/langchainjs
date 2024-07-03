import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { MultiFileLoader } from "../fs/multi_file.js";
import { CSVLoader } from "../fs/csv.js";
import { PDFLoader } from "../fs/pdf.js";
import { TextLoader } from "../fs/text.js";
import { JSONLoader } from "../fs/json.js";
import { UnknownHandling } from "../fs/directory.js";

test("Test MultiFileLoader", async () => {
  const baseDirectory = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data"
  );

  const filePaths = [
    path.resolve(baseDirectory, "1706.03762.pdf"),
    path.resolve(baseDirectory, "Jacob_Lee_Resume_2023.pdf"),
    path.resolve(
      baseDirectory,
      "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
    ),
    path.resolve(
      baseDirectory,
      "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
    ),
    path.resolve(baseDirectory, "complex.json"),
    path.resolve(baseDirectory, "example.txt"),
    path.resolve(baseDirectory, "example_separator.csv"),
  ];

  const loader = new MultiFileLoader(
    filePaths,
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
    UnknownHandling.Ignore
  );

  const docs = await loader.load();
  expect(docs.length).toBe(123);

  const expectedSources = [
    // PDF
    ...Array.from({ length: 15 }, (_) =>
      path.resolve(baseDirectory, "1706.03762.pdf")
    ),
    path.resolve(baseDirectory, "Jacob_Lee_Resume_2023.pdf"),
    // CSV
    ...Array.from({ length: 32 }, (_) =>
      path.resolve(
        baseDirectory,
        "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.csv"
      )
    ),
    // JSON
    ...Array.from({ length: 32 }, (_) =>
      path.resolve(
        baseDirectory,
        "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
      )
    ),
    ...Array.from({ length: 10 }, (_) =>
      path.resolve(baseDirectory, "complex.json")
    ),
    // TXT
    path.resolve(baseDirectory, "example.txt"),
    // CSV
    ...Array.from({ length: 32 }, (_) =>
      path.resolve(baseDirectory, "example_separator.csv")
    ),
  ];

  expect(docs.map((d) => d.metadata.source).sort()).toEqual(expectedSources);
});
