/* eslint-disable @typescript-eslint/no-explicit-any, no-process-env, @typescript-eslint/no-floating-promises */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenAITranscriptions } from "./index.js";

// Mock the toFile function
vi.mock("openai", () => {
  console.log('mocking openai');
  return {
    OpenAI: class {
      config: any;

      audio: any;

      constructor(config: any) {
        this.config = config;
        this.audio = {
          transcriptions: {
            create: vi.fn().mockResolvedValue({
              text: "test",
            } as never),
          }
        }
      }
    },
  }
});

// Integration tests for OpenAI Transcriptions
describe("OpenAITranscriptions", () => {
  let transcriber: OpenAITranscriptions<any>;

  beforeEach(() => {
    transcriber = new OpenAITranscriptions({
      model: "whisper-1",
      apiKey: process.env.OPENAI_API_KEY || "test-key",
      temperature: 0.2,
      response_format: "json",
    });
  });

  it("should transcribe an audio file", async () => {
    const result = await transcriber.transcribe({
      audio: new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
    });
    expect(result.text).toBe("test");
    // @ts-expect-error protected property
    expect(transcriber.client.audio.transcriptions.create).toHaveBeenCalledWith({
      model: "whisper-1",
      file: expect.anything(), // OpenAI's `toFile` function doesn't use the File constructor, so we can't use expect.any(File)
      response_format: "json",
      temperature: 0.2,
    }, {});
  });

  it('should throw an error if the audio is not a valid file', async () => {
    await expect(transcriber.transcribe({
      audio: Buffer.from('not a valid audio file'),
    })).rejects.toThrow();
  });

  it('should allow to pass in custom options', async () => {
    const result = await transcriber.transcribe({
      audio: new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
      options: {
        language: 'en',
        prompt: 'test prompt',
        temperature: 0.5,
        timestamp_granularities: ['word'],
      },
    });
    expect(result.text).toBe("test");
    // @ts-expect-error protected property
    expect(transcriber.client.audio.transcriptions.create).toHaveBeenCalledWith({
      model: "whisper-1",
      file: expect.anything(), // OpenAI's `toFile` function doesn't use the File constructor, so we can't use expect.any(File)
      response_format: "json",
      temperature: 0.5,
      language: 'en',
      prompt: 'test prompt',
      timestamp_granularities: ['word'],
    }, {});
  });
}); 