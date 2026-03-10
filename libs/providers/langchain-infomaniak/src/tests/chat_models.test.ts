import { describe, test, expect, beforeAll } from "vitest";
import { ChatInfomaniak } from "../chat_models.js";

beforeAll(() => {
  process.env.INFOMANIAK_API_KEY = "test-key";
  process.env.INFOMANIAK_PRODUCT_ID = "12345";
});

describe("ChatInfomaniak", () => {
  test("should instantiate with default model", () => {
    const model = new ChatInfomaniak();
    expect(model._llmType()).toBe("infomaniak");
  });

  test("should instantiate with string model argument", () => {
    const model = new ChatInfomaniak("qwen3");
    expect(model._llmType()).toBe("infomaniak");
  });

  test("should instantiate with fields", () => {
    const model = new ChatInfomaniak({
      model: "qwen3",
      temperature: 0.5,
    });
    expect(model._llmType()).toBe("infomaniak");
  });

  test("should throw if API key is missing", () => {
    const original = process.env.INFOMANIAK_API_KEY;
    process.env.INFOMANIAK_API_KEY = "";
    expect(() => new ChatInfomaniak({ apiKey: "" })).toThrow(
      "Infomaniak API key not found"
    );
    process.env.INFOMANIAK_API_KEY = original;
  });

  test("should throw if product ID is missing", () => {
    const original = process.env.INFOMANIAK_PRODUCT_ID;
    process.env.INFOMANIAK_PRODUCT_ID = "";
    expect(() => new ChatInfomaniak({ productId: "" })).toThrow(
      "Infomaniak product ID not found"
    );
    process.env.INFOMANIAK_PRODUCT_ID = original;
  });

  test("lc_secrets should contain apiKey", () => {
    const model = new ChatInfomaniak();
    expect(model.lc_secrets).toEqual({ apiKey: "INFOMANIAK_API_KEY" });
  });

  test("static lc_name should return ChatInfomaniak", () => {
    expect(ChatInfomaniak.lc_name()).toBe("ChatInfomaniak");
  });
});
