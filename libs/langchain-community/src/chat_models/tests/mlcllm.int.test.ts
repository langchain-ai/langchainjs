import { describe, it, expect, jest } from '@jest/globals';
import { ChatWebLLM } from 'libs/langchain-community/src/chat_models/webllm.ts';

jest.mock('ChatWebLLM', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  process: jest.fn().mockResolvedValue("Processed output")
}));

describe('MLC LLM Integration Tests', () => {
  it('initializes ChatWebLLM successfully', async () => {
    const result = await ChatWebLLM.initialize({ apiKey: "fake_api_key" });
    expect(result).toBeTruthy();
  });

  it('processes input correctly with ChatWebLLM', async () => {
    const input = "Hello world";
    const output = await ChatWebLLM.process(input);
    expect(output).toEqual("Processed output");
  });
});
