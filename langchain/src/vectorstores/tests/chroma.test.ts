import { test, expect } from "@jest/globals";

import { Chroma } from "../chroma.js";

// We'd want a much more thorough test here,
// but sadly Chroma isn't very easy to test locally at the moment.
test("Chroma imports correctly", async () => {
  const { ChromaClient } = await Chroma.imports();

  expect(ChromaClient).toBeDefined();
});
