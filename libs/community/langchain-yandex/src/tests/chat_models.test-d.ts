import { describe, it, expectTypeOf } from "vitest";
import { ChatYandexGPT } from "../chat_models.js";

describe("ChatYandexGPT constructor overloads", () => {
  it("accepts a model string", async () => {
    const chat = new ChatYandexGPT("yandexgpt-lite", {
      apiKey: "api-key",
      modelURI: "gpt://folder/yandexgpt-lite/latest",
    });
    expectTypeOf(chat).toEqualTypeOf<ChatYandexGPT>();
  });

  it("accepts a params object", async () => {
    const chat = new ChatYandexGPT({
      model: "yandexgpt-lite",
      apiKey: "api-key",
      modelURI: "gpt://folder/yandexgpt-lite/latest",
    });
    expectTypeOf(chat).toEqualTypeOf<ChatYandexGPT>();
  });

  it("rejects non-string model shorthand", async () => {
    // @ts-expect-error model shorthand must be a string
    new ChatYandexGPT(123);
  });
});
