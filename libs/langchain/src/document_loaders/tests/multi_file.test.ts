import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { MultiFileLoader } from "../fs/multi_file.js";
import { TextLoader } from "../fs/text.js";
import { JSONLoader } from "../fs/json.js";
import { UnknownHandling } from "../fs/directory.js";

test("Test MultiFileLoader", async () => {
  const baseDirectory = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data"
  );

  const filePaths = [
    path.resolve(
      baseDirectory,
      "Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
    ),
    path.resolve(baseDirectory, "complex.json"),
    path.resolve(baseDirectory, "example.txt"),
  ];

  const loader = new MultiFileLoader(
    filePaths,
    {
      ".txt": (p) => new TextLoader(p),
      ".json": (p) => new JSONLoader(p),
    },
    UnknownHandling.Ignore
  );

  const docs = await loader.load();
  expect(docs.length).toBe(43);

  const expectedSources = [
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
  ];

  expect(docs.map((d) => d.metadata.source).sort()).toEqual(expectedSources);
});
