import { describe, test, expect } from "vitest";
import { InfomaniakLLM } from "../llms.js";

describe("InfomaniakLLM integration", () => {
  test("invoke returns text", async () => {
    const llm = new InfomaniakLLM({
      model: "qwen3",
      temperature: 0,
      maxTokens: 50,
    });
    const result = await llm.invoke("Say hello in one word.");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("generate with multiple prompts", async () => {
    const llm = new InfomaniakLLM({
      model: "qwen3",
      temperature: 0,
      maxTokens: 50,
    });
    const result = await llm.generate(["Say hi.", "Say bye."]);
    expect(result.generations.length).toBe(2);
    expect(result.generations[0][0].text.length).toBeGreaterThan(0);
    expect(result.generations[1][0].text.length).toBeGreaterThan(0);
  });

  test("streaming returns chunks", async () => {
    const llm = new InfomaniakLLM({
      model: "qwen3",
      temperature: 0,
      maxTokens: 50,
      streaming: true,
    });

    let fullText = "";
    const result = await llm.invoke("Count from 1 to 5.", {
      callbacks: [
        {
          handleLLMNewToken(token: string) {
            fullText += token;
          },
        },
      ],
    });

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Streaming callback should have received tokens
    expect(fullText.length).toBeGreaterThan(0);
  }, 30000);
});
