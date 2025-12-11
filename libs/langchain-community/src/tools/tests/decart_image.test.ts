import { test, expect } from "@jest/globals";
import { DecartImageGeneration } from "../decart_image.js";

test("DecartImageGeneration can be instantiated with API key", () => {
  const tool = new DecartImageGeneration({ apiKey: "test-key" });
  expect(tool.name).toBe("decart_image_generation");
  expect(tool.description).toContain("Generate images");
});

test("DecartImageGeneration throws without API key", () => {
  const originalEnv = process.env.DECART_API_KEY;
  delete process.env.DECART_API_KEY;

  expect(() => new DecartImageGeneration()).toThrow(
    "Decart API key is required"
  );

  if (originalEnv !== undefined) {
    process.env.DECART_API_KEY = originalEnv;
  }
});

test("DecartImageGeneration accepts custom configuration", () => {
  const tool = new DecartImageGeneration({
    apiKey: "test-key",
    resolution: "480p",
    orientation: "landscape",
    enhancePrompt: false,
  });
  expect(tool.name).toBe("decart_image_generation");
});
