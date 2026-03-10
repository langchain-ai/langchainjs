import { describe, test, expect, beforeAll } from "vitest";
import { InfomaniakLLM } from "../llms.js";

beforeAll(() => {
  process.env.INFOMANIAK_API_KEY = "test-key";
  process.env.INFOMANIAK_PRODUCT_ID = "12345";
});

describe("InfomaniakLLM", () => {
  test("should instantiate with defaults", () => {
    const llm = new InfomaniakLLM();
    expect(llm._llmType()).toBe("infomaniak");
    expect(llm.model).toBe("qwen3");
  });

  test("should instantiate with custom model", () => {
    const llm = new InfomaniakLLM({
      model: "swiss-ai/Apertus-70B-Instruct-2509",
      temperature: 0.5,
    });
    expect(llm.model).toBe("swiss-ai/Apertus-70B-Instruct-2509");
    expect(llm.temperature).toBe(0.5);
  });

  test("should throw if API key is missing", () => {
    const original = process.env.INFOMANIAK_API_KEY;
    process.env.INFOMANIAK_API_KEY = "";
    expect(() => new InfomaniakLLM({ apiKey: "" })).toThrow(
      "Infomaniak API key not found"
    );
    process.env.INFOMANIAK_API_KEY = original;
  });

  test("should throw if product ID is missing", () => {
    const original = process.env.INFOMANIAK_PRODUCT_ID;
    process.env.INFOMANIAK_PRODUCT_ID = "";
    expect(() => new InfomaniakLLM({ productId: "" })).toThrow(
      "Infomaniak product ID not found"
    );
    process.env.INFOMANIAK_PRODUCT_ID = original;
  });

  test("lc_secrets should contain apiKey", () => {
    const llm = new InfomaniakLLM();
    expect(llm.lc_secrets).toEqual({ apiKey: "INFOMANIAK_API_KEY" });
  });

  test("static lc_name should return InfomaniakLLM", () => {
    expect(InfomaniakLLM.lc_name()).toBe("InfomaniakLLM");
  });

  test("should accept streaming parameter", () => {
    const llm = new InfomaniakLLM({ streaming: true });
    expect(llm.streaming).toBe(true);
  });
});
