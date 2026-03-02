import { describe, it, expect } from "vitest";
import { ChatYandexGPT } from "../chat_models.js";

describe("ChatYandexGPT constructor overloads", () => {
  it("accepts a model string shorthand", () => {
    const modelUri = "gpt://folder/custom-model/latest";
    const chat = new ChatYandexGPT("custom-model", {
      apiKey: "api-key",
      modelURI: modelUri,
      temperature: 0.1,
    });

    expect(chat.model).toBe("custom-model");
    expect(chat.modelURI).toBe(modelUri);
  });

  it("accepts a params object", () => {
    const modelUri = "gpt://folder/params-model/latest";
    const chat = new ChatYandexGPT({
      model: "params-model",
      apiKey: "api-key",
      modelURI: modelUri,
      maxTokens: 10,
    });

    expect(chat.model).toBe("params-model");
    expect(chat.modelURI).toBe(modelUri);
  });
});
