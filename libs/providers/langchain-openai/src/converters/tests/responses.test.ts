/* eslint-disable @typescript-eslint/no-explicit-any */
import { convertResponsesUsageToUsageMetadata } from "../responses.js";

describe("_convertOpenAIResponsesUsageToLangChainUsage", () => {
  it("should convert OpenAI Responses usage to LangChain format with cached tokens", () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_tokens_details: {
        cached_tokens: 75,
        text_tokens: 25,
      },
      output_tokens_details: {
        reasoning_tokens: 10,
        text_tokens: 40,
      },
    };

    const result = convertResponsesUsageToUsageMetadata(usage as any);

    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_token_details: {
        cache_read: 75,
      },
      output_token_details: {
        reasoning: 10,
      },
    });
  });

  it("should handle missing usage details gracefully", () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
    };

    const result = convertResponsesUsageToUsageMetadata(usage as any);

    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      total_tokens: 150,
      input_token_details: {},
      output_token_details: {},
    });
  });

  it("should handle undefined usage", () => {
    const result = convertResponsesUsageToUsageMetadata(undefined);

    expect(result).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      input_token_details: {},
      output_token_details: {},
    });
  });
});
