import { test, expect, jest } from "@jest/globals";
import { TogetherAI } from "../togetherai.js";

test("TogetherAI should provide helpful error for chat models", async () => {
  const model = new TogetherAI({
    modelName: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    apiKey: "test-api-key",
  });

  jest.spyOn(model, "completionWithRetry").mockResolvedValue({
    // Response without output or choices fields
    error: "Invalid model",
  });

  await expect(model.invoke("Hello")).rejects.toThrow(
    /may require the ChatTogetherAI class/
  );
});

test("TogetherAI should warn when using chat models", () => {
  const originalWarn = console.warn;
  const mockWarn = jest.fn();
  console.warn = mockWarn;

  try {
    void new TogetherAI({
      modelName: "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo",
      apiKey: "test-api-key",
    });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("appears to be a chat/instruct model")
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Consider using ChatTogetherAI")
    );
  } finally {
    console.warn = originalWarn;
  }
});
