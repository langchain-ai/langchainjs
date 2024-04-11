import { test } from "@jest/globals";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { GuardrailResponse } from "@layerup/layerup-security/types.js";
import {
  LayerupSecurity,
  LayerupSecurityOptions,
} from "../layerup_security.js";

// Mock LLM for testing purposes
export class MockLLM extends LLM {
  static lc_name() {
    return "MockLLM";
  }

  lc_serializable = true;

  _llmType() {
    return "mock_llm";
  }

  async _call(_input: string, _options?: BaseLLMParams): Promise<string> {
    return "Hi Bob! How are you?";
  }
}

test("Test LayerupSecurity with invalid API key", async () => {
  const mockLLM = new MockLLM({});
  const layerupSecurityOptions: LayerupSecurityOptions = {
    llm: mockLLM,
    layerupApiKey: "-- invalid API key --",
    layerupApiBaseUrl: "https://api.uselayerup.com/v1",
    promptGuardrails: [],
    responseGuardrails: ["layerup.hallucination"],
    mask: false,
    metadata: { customer: "example@uselayerup.com" },
    handleResponseGuardrailViolation: (violation: GuardrailResponse) => ({
      role: "assistant",
      content: `Custom canned response with dynamic data! The violation rule was ${violation.offending_guardrail}.`,
    }),
  };

  await expect(async () => {
    const layerupSecurity = new LayerupSecurity(layerupSecurityOptions);
    await layerupSecurity.invoke(
      "My name is Bob Dylan. My SSN is 123-45-6789."
    );
  }).rejects.toThrowError();
}, 50000);
