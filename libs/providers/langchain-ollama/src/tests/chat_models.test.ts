import { describe, expect, test } from "vitest";
import { ChatOllama } from "../chat_models.js";

describe("ChatOllama constructor overload", () => {
  test("accepts a model string shorthand", () => {
    const modelFromString = new ChatOllama("llama3");
    const modelFromObject = new ChatOllama({ model: "llama3" });

    expect(modelFromString.model).toBe("llama3");
    expect(modelFromObject.model).toBe("llama3");
  });

  test("merges model string with additional params", () => {
    const baseUrl = "http://127.0.0.1:11435";
    const model = new ChatOllama("llama3", { baseUrl });

    expect(model.model).toBe("llama3");
    expect(model.baseUrl).toBe(baseUrl);
  });
});
