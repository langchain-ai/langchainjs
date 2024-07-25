import { _isValidMistralToolCallId, _convertToolCallIdToMistralCompatible } from '../utils.js';

describe('Mistral Tool Call ID Conversion', () => {
  test('valid and invalid Mistral tool call IDs', () => {
    expect(_isValidMistralToolCallId("ssAbar4Dr")).toBe(true);
    expect(_isValidMistralToolCallId("abc123")).toBe(false);
    expect(_isValidMistralToolCallId("call_JIIjI55tTipFFzpcP8re3BpM")).toBe(false);
  });

  test('tool call ID conversion', () => {
    const resultMap: Record<string, string> = {
      "ssAbar4Dr": "ssAbar4Dr",
      "abc123": "0001yoN1K",
      "call_JIIjI55tTipFFzpcP8re3BpM": "0001sqrj5",
    };

    for (const [inputId, expectedOutput] of Object.entries(resultMap)) {
      const convertedId = _convertToolCallIdToMistralCompatible(inputId);
      expect(convertedId).toBe(expectedOutput);
      expect(_isValidMistralToolCallId(convertedId)).toBe(true);
    }
  });
});