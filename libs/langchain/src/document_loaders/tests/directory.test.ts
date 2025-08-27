import url from "node:url";
import path from "node:path";

import { test, expect } from "vitest";

import { DirectoryLoader, UnknownHandling } from "../fs/directory.js";
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
      ".txt": (p) => new TextLoader(p),
      ".json": (p) => new JSONLoader(p),
    },
    false,
    UnknownHandling.Ignore
  );
  const docs = await loader.load();
  expect(docs.length).toBe(43);
  expect(docs.map((d) => d.metadata.source).sort()).toEqual([
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
  ]);
});
