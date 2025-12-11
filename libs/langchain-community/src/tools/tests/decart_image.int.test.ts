import { test, expect } from "@jest/globals";
import { DecartImageGeneration } from "../decart_image.js";

// Integration tests are skipped by default as they require a valid DECART_API_KEY.
// To run: DECART_API_KEY=your-key pnpm test:int

test.skip("DecartImageGeneration generates an image", async () => {
  const tool = new DecartImageGeneration();

  const result = await tool.invoke("A beautiful sunset over mountains");

  // Result should be a base64 data URL
  expect(result).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
});

test.skip("DecartImageGeneration with portrait orientation", async () => {
  const tool = new DecartImageGeneration({
    orientation: "portrait",
  });

  const result = await tool.invoke("A cat sitting on a windowsill");

  expect(result).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
});
