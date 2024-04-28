import { describe, it, expect, jest } from '@jest/globals';
import mlc_llm from 'mlc_llm';

jest.mock('mlc_llm', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  process: jest.fn().mockResolvedValue("Processed output")
}));

describe('MLC LLM Integration Tests', () => {
  it('initializes mlc_llm successfully', async () => {
    const result = await mlc_llm.initialize({ apiKey: "fake_api_key" });
    expect(result).toBeTruthy();
  });

  it('processes input correctly with mlc_llm', async () => {
    const input = "Hello world";
    const output = await mlc_llm.process(input);
    expect(output).toEqual("Processed output");
  });
});
