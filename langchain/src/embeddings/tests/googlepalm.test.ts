/* eslint-disable no-new */
import { test } from "@jest/globals";
import { GooglePalmEmbeddings } from "../googlepalm.js";

test("Google Palm Embeddings - `model` name starts with `models/`", async () => {
  expect(() => {
    new GooglePalmEmbeddings({
      model: `text-bison-001`,
    });
  }).toThrow();
});

test("Google Palm Embeddings - `apiKey` must be available if no `GOOGLEPALM_API_KEY` env available", async () => {
  expect(() => {
    new GooglePalmEmbeddings({});
  }).toThrow();
});
