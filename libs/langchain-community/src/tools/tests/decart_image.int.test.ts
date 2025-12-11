import { test } from "@jest/globals";
import { DecartImageGeneration } from "../decart_image.js";

test.skip("DecartImageGeneration generates an image", async () => {
  const tool = new DecartImageGeneration();

  const result = await tool.invoke("A beautiful sunset over mountains");

  // Result should be a base64 data URL
  expect(result).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
});

test.skip("DecartImageGeneration with custom options", async () => {
  const tool = new DecartImageGeneration({
    resolution: "480p",
    orientation: "landscape",
    enhancePrompt: false,
  });

  const result = await tool.invoke("A cat sitting on a windowsill");

  expect(result).toMatch(/^data:image\/(png|jpeg|webp);base64,/);
});
