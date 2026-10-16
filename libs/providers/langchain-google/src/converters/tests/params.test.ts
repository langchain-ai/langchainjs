import { describe, expect, test } from "vitest";
import {
  convertFieldsToThinkingConfig,
  convertFieldsToSpeechConfig,
  convertFieldsToServiceTier,
} from "../generate_content/params.js";
import {
  convertReasoningEffortToReasoningTokens,
  convertReasoningTokensToReasoningEffort,
  convertParamsToPlatformType,
} from "../shared/params.js";

describe("convertReasoningEffortToReasoningTokens", () => {
  test("returns undefined when effort is undefined", () => {
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-flash", undefined)
    ).toBeUndefined();
  });

  test("returns 0 for none/minimal on gemini-2.5-flash", () => {
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "none")
    ).toBe(0);
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "minimal")
    ).toBe(0);
  });

  test("returns 128 for none/minimal on other models", () => {
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-pro", "none")
    ).toBe(128);
    expect(
      convertReasoningEffortToReasoningTokens("gemini-1.5-pro", "minimal")
    ).toBe(128);
  });

  test("returns 1024 for low across models", () => {
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "low")
    ).toBe(1024);
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-pro", "low")
    ).toBe(1024);
  });

  test("returns 8192 for medium across models", () => {
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "medium")
    ).toBe(8192);
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-pro", "medium")
    ).toBe(8192);
  });

  test("returns maxTokens for high based on model", () => {
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-flash", "high")
    ).toBe(24 * 1024);
    expect(
      convertReasoningEffortToReasoningTokens("gemini-2.5-pro", "high")
    ).toBe(32 * 1024);
  });
});

describe("convertReasoningTokensToReasoningEffort", () => {
  test("returns undefined when budget is undefined", () => {
    expect(
      convertReasoningTokensToReasoningEffort("gemini-2.5-flash", undefined)
    ).toBeUndefined();
  });

  test("returns minimal for flash-lite default (-1)", () => {
    expect(
      convertReasoningTokensToReasoningEffort("gemini-2.5-flash-lite", -1)
    ).toBe("minimal");
  });

  test("returns high for other model defaults (-1)", () => {
    expect(
      convertReasoningTokensToReasoningEffort("gemini-2.5-flash", -1)
    ).toBe("high");
  });

  test("returns minimal for budget 0 (unless gemini-3-pro)", () => {
    expect(convertReasoningTokensToReasoningEffort("gemini-2.5-flash", 0)).toBe(
      "minimal"
    );
    expect(convertReasoningTokensToReasoningEffort("gemini-3-pro", 0)).toBe(
      "low"
    );
  });

  test("maps ranges appropriately", () => {
    expect(
      convertReasoningTokensToReasoningEffort("gemini-2.5-flash", 1000)
    ).toBe("low");
    expect(
      convertReasoningTokensToReasoningEffort("gemini-2.5-flash", 5000)
    ).toBe("medium");
    expect(
      convertReasoningTokensToReasoningEffort("gemini-2.5-flash", 10000)
    ).toBe("high");
  });
});

describe("convertFieldsToThinkingConfig", () => {
  test("returns undefined if no thinking budget or effort specified", () => {
    expect(
      convertFieldsToThinkingConfig("gemini-2.5-flash", {})
    ).toBeUndefined();
  });

  test("configures thinkingBudget for gemini-2.5 models", () => {
    const config = convertFieldsToThinkingConfig("gemini-2.5-flash", {
      thinkingBudget: 2048,
    });
    expect(config).toEqual({
      includeThoughts: true,
      thinkingBudget: 2048,
    });
  });

  test("turns off thoughts when budget is 0", () => {
    const config = convertFieldsToThinkingConfig("gemini-2.5-flash", {
      thinkingBudget: 0,
    });
    expect(config).toEqual({
      includeThoughts: false,
      thinkingBudget: 0,
    });
  });
});

describe("convertFieldsToSpeechConfig", () => {
  test("returns undefined when no speechConfig is provided", () => {
    expect(convertFieldsToSpeechConfig({})).toBeUndefined();
  });

  test("converts voice string to prebuiltVoiceConfig", () => {
    const config = convertFieldsToSpeechConfig({
      speechConfig: "Puck",
    });
    expect(config).toEqual({
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Puck",
        },
      },
    });
  });

  test("passes through existing wire SpeechConfig", () => {
    const wireConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: "Puck",
        },
      },
    };
    expect(convertFieldsToSpeechConfig({ speechConfig: wireConfig })).toEqual(
      wireConfig
    );
  });
});

describe("convertFieldsToServiceTier", () => {
  test("returns empty object for gcp platform", () => {
    expect(convertFieldsToServiceTier("gcp", { serviceTier: "flex" })).toEqual(
      {}
    );
  });

  test("returns serviceTier for valid gai settable tier", () => {
    expect(convertFieldsToServiceTier("gai", { serviceTier: "flex" })).toEqual({
      serviceTier: "flex",
    });
    expect(
      convertFieldsToServiceTier("gai", { serviceTier: "priority" })
    ).toEqual({ serviceTier: "priority" });
  });

  test("returns empty object for invalid/unset serviceTier", () => {
    expect(convertFieldsToServiceTier("gai", {})).toEqual({});
  });
});

describe("convertParamsToPlatformType", () => {
  test("returns explicit platformType when set", () => {
    expect(convertParamsToPlatformType({ platformType: "gai" })).toBe("gai");
    expect(convertParamsToPlatformType({ platformType: "gcp" })).toBe("gcp");
  });

  test("maps vertexai: true to gcp", () => {
    expect(convertParamsToPlatformType({ vertexai: true })).toBe("gcp");
  });

  test("returns undefined when unset", () => {
    expect(convertParamsToPlatformType(undefined)).toBeUndefined();
    expect(convertParamsToPlatformType({})).toBeUndefined();
  });
});
