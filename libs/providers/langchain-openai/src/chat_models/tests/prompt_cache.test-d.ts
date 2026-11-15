import { describe, expectTypeOf, it } from "vitest";
import type { OpenAI as OpenAIClient } from "openai";
import type { OpenAICacheRetentionParam } from "../../types.js";

describe("OpenAICacheRetentionParam", () => {
  it("accepts every retention value the OpenAI SDK accepts", () => {
    expectTypeOf<
      NonNullable<
        OpenAIClient.Chat.ChatCompletionCreateParams["prompt_cache_retention"]
      >
    >().toExtend<OpenAICacheRetentionParam>();
    expectTypeOf<
      NonNullable<
        OpenAIClient.Responses.ResponseCreateParams["prompt_cache_retention"]
      >
    >().toExtend<OpenAICacheRetentionParam>();
  });

  it("still accepts the legacy in-memory spelling", () => {
    expectTypeOf<"in-memory">().toExtend<OpenAICacheRetentionParam>();
  });
});
