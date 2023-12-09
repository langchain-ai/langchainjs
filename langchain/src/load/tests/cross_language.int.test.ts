import { test } from "@jest/globals";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import * as path from "node:path";

// import { load } from "../index.js";

const IMPORTANT_IMPORTS = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "data",
      "important_imports.json"
    )
  ).toString()
);

describe("Test cross language serialization of important modules", () => {
  // https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/load/mapping.py
  test.each(Object.keys(IMPORTANT_IMPORTS))(
    "Test matching serialization names for: %s",
    async (_item) => {
      // const idComponents = item.split("/");
      // const mockItem = {
      //   lc: 1,
      //   type: "constructor",
      //   id: idComponents,
      //   kwargs: {}
      // };
      // try {
      //   const result = await load(JSON.stringify(mockItem)) as any;
      //   expect(result.constructor.name).toEqual(idComponents[idComponents.length - 1]);
      // } catch (e: any) {
      //   expect(e.message).not.toContain("Invalid identifer: $");
      // }
    }
  );
});
