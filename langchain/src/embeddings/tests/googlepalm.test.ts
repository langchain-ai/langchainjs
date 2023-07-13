import { test } from "@jest/globals";
import { GooglePaLMEmbeddings } from "../googlepalm.js";

test("Google Palm Embeddings - `apiKey` must be available if no `GOOGLEPALM_API_KEY` env available", async () => {
  expect(() => new GooglePaLMEmbeddings({})).toThrow();
});
