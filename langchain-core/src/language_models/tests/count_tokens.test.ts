import { describe, it, expect } from "@jest/globals";
import { calculateMaxTokens, getModelContextSize } from "../base.js";
import { MessageContent } from "../../messages/base.js";
import { FakeLLM } from "../../utils/testing/index.js";

describe("calculateMaxTokens", () => {
  it("properly calculates correct max tokens", async () => {
    expect(
      await calculateMaxTokens({ prompt: "", modelName: "gpt-3.5-turbo-16k" })
    ).toBe(16384);
    expect(
      await calculateMaxTokens({
        prompt: "",
        modelName: "gpt-3.5-turbo-16k-0613",
      })
    ).toBe(16384);

    expect(
      await calculateMaxTokens({ prompt: "", modelName: "gpt-3.5-turbo" })
    ).toBe(4096);

    expect(await calculateMaxTokens({ prompt: "", modelName: "gpt-4" })).toBe(
      8192
    );
    expect(
      await calculateMaxTokens({ prompt: "", modelName: "gpt-4-32k" })
    ).toBe(32768);
  });
});

describe("getModelContextSize", () => {
  it("properly gets model context size", async () => {
    expect(await getModelContextSize("gpt-3.5-turbo-16k")).toBe(16384);
    expect(await getModelContextSize("gpt-3.5-turbo-16k-0613")).toBe(16384);
    expect(await getModelContextSize("gpt-3.5-turbo")).toBe(4096);
    expect(await getModelContextSize("gpt-4")).toBe(8192);
    expect(await getModelContextSize("gpt-4-32k")).toBe(32768);
  });
});

describe("getNumTokens", () => {
  it("handles mixed content correctly", async () => {
    const model = new FakeLLM({});

    // Test string content
    const stringContent: MessageContent = "What is this image?";
    const stringTokens = await model.getNumTokens(stringContent);
    expect(stringTokens).toBeGreaterThan(0);

    // Test mixed content array - text + image_url
    const mixedContent: MessageContent = [
      {
        type: "text",
        text: "What is this image?",
      },
      {
        type: "image_url",
        image_url: {
          url: "https://www.w3.org/MarkUp/Test/xhtml-print/20050519/tests/jpeg420exif.jpg",
        },
        detail: "high",
      },
    ];
    const mixedTokens = await model.getNumTokens(mixedContent);

    // The token count should be the same for the text part, ignoring the image_url
    expect(mixedTokens).toBe(stringTokens);
    expect(mixedTokens).toBeGreaterThan(0);
  });

  it("handles array with only text content", async () => {
    const model = new FakeLLM({});
    const textOnlyArray: MessageContent = [
      {
        type: "text",
        text: "Hello ",
      },
      {
        type: "text",
        text: "world!",
      },
    ];
    const textOnlyTokens = await model.getNumTokens(textOnlyArray);
    const combinedStringTokens = await model.getNumTokens("Hello world!");
    expect(textOnlyTokens).toBe(combinedStringTokens);
  });

  it("handles empty array", async () => {
    const model = new FakeLLM({});
    const emptyArray: MessageContent = [];
    const emptyTokens = await model.getNumTokens(emptyArray);
    expect(emptyTokens).toBe(0);

    // Test array with only non-text content (should return 0 tokens)
    const imageOnlyContent: MessageContent = [
      {
        type: "image_url",
        image_url: {
          url: "https://example.com/image.jpg",
        },
      },
    ];
    const imageOnlyTokens = await model.getNumTokens(imageOnlyContent);
    expect(imageOnlyTokens).toBe(0);
  });
});
