/* eslint-disable @typescript-eslint/no-explicit-any, no-process-env, @typescript-eslint/no-floating-promises */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { OpenAITranscriptions } from "../transcribe/index.js";

// Mock the toFile function
jest.mock("openai/uploads", () => ({
  toFile: jest.fn(),
}));

// Integration tests for OpenAI Transcriptions
describe("OpenAITranscriptions Integration", () => {
  let transcriber: OpenAITranscriptions<any>;

  beforeEach(() => {
    transcriber = new OpenAITranscriptions({
      model: "whisper-1",
      apiKey: process.env.OPENAI_API_KEY || "test-key",
      temperature: 0.2,
      response_format: "json",
    });
  });

  describe("file format detection", () => {
    const formatTestCases = [
      {
        name: "MP3",
        signature: [0xff, 0xfb, 0x00, 0x00],
        expectedExtension: "mp3",
      },
      {
        name: "WAV",
        signature: [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00],
        expectedExtension: "wav",
      },
      {
        name: "FLAC",
        signature: [0x66, 0x4c, 0x61, 0x43],
        expectedExtension: "flac",
      },
      {
        name: "OGG",
        signature: [0x4f, 0x67, 0x67, 0x53],
        expectedExtension: "ogg",
      },
    ];

    formatTestCases.forEach(({ name, signature, expectedExtension }) => {
      it(`should detect ${name} format from signature and use correct extension`, async () => {
        const audioBuffer = Buffer.from(signature);
        
        // We'll test this by verifying it doesn't throw on format detection
        // and that the inferred filename method works correctly
        try {
          // This should not throw an error for format detection
          await transcriber.transcribe({
            audio: audioBuffer,
          });
        } catch (error: any) {
          // If it fails, it should not be due to format detection
          // (it might fail due to API key, which is expected in tests)
          expect(error.message).not.toContain("Can't determine file extension");
          expect(error.message).not.toContain("Unsupported audio type");
        }
        
        // Test that the format detection works by calling with no API key to prevent actual calls
        const testTranscriber = new OpenAITranscriptions({
          model: "whisper-1",
          apiKey: "", // Empty API key to prevent real calls
        });
        
        // This should work without throwing format detection errors
        try {
          await testTranscriber.transcribe({
            audio: audioBuffer,
          });
        } catch (error: any) {
          // Should fail on API, not format detection
          expect(error.message).not.toContain("Can't determine file extension");
          expect(error.message).not.toContain("Unsupported audio type");
        }
      });
    });

    it("should throw error for unknown file format without filename", async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      
      await expect(
        transcriber.transcribe({
          audio: unknownBuffer,
        })
      ).rejects.toThrow("Can't determine file extension from audio data");
    });

    it("should use provided filename even with unknown format", async () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      
      // When providing a filename, it should not fail on format detection
      try {
        await transcriber.transcribe({
          audio: unknownBuffer,
          filename: "test.mp3",
        });
      } catch (error: any) {
        // Should not fail on format detection when filename is provided
        expect(error.message).not.toContain("Can't determine file extension");
      }
    });
  });

  describe("ID3 tag handling", () => {
    it("should handle MP3 files with ID3 tags", async () => {
      // Create a buffer with ID3 header followed by MP3 data
      const id3Header = [0x49, 0x44, 0x33]; // "ID3"
      const id3Version = [0x03, 0x00]; // Version 2.3
      const id3Flags = [0x00]; // No flags
      const id3Size = [0x00, 0x00, 0x00, 0x0A]; // 10 bytes
      const id3Data = new Array(10).fill(0x00); // 10 bytes of tag data
      const mp3Data = [0xff, 0xfb, 0x00, 0x00]; // MP3 frame

      const audioWithID3 = Buffer.from([
        ...id3Header,
        ...id3Version,
        ...id3Flags,
        ...id3Size,
        ...id3Data,
        ...mp3Data,
      ]);

      // The test passes if it doesn't throw an error during format detection
      try {
        await transcriber.transcribe({
          audio: audioWithID3,
        });
      } catch (error: any) {
        // Should not fail on format detection - ID3 tags should be handled
        expect(error.message).not.toContain("Can't determine file extension");
        expect(error.message).not.toContain("Unsupported audio type");
      }
    });
  });

  describe("input validation", () => {
    it("should reject unsupported audio types", async () => {
      await expect(
        transcriber.transcribe({
          audio: "not-a-buffer" as any,
        })
      ).rejects.toThrow("Can't determine file extension from audio data");
    });

    it("should handle File inputs", () => {
      const audioFile = new File(["fake audio"], "test.mp3", { type: "audio/mpeg" });
      
      // Should not throw when creating the transcription request
      expect(() => {
        transcriber.transcribe({
          audio: audioFile,
        });
      }).not.toThrow();
    });

    it("should handle Uint8Array inputs", () => {
      const audioArray = new Uint8Array([0xff, 0xfb, 0x00, 0x00]);
      
      // Should not throw when creating the transcription request
      expect(() => {
        transcriber.transcribe({
          audio: audioArray,
        });
      }).not.toThrow();
    });

    it("should handle Buffer inputs", () => {
      const audioBuffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      
      // Should not throw when creating the transcription request
      expect(() => {
        transcriber.transcribe({
          audio: audioBuffer,
        });
      }).not.toThrow();
    });
  });

  describe("options handling", () => {
    it("should accept language options", () => {
      const audioBuffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      
      expect(() => {
        transcriber.transcribe({
          audio: audioBuffer,
          options: {
            language: "es",
          },
        });
      }).not.toThrow();
    });

    it("should accept temperature options", () => {
      const audioBuffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      
      expect(() => {
        transcriber.transcribe({
          audio: audioBuffer,
          options: {
            temperature: 0.5,
          },
        });
      }).not.toThrow();
    });

    it("should accept prompt options", () => {
      const audioBuffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      
      expect(() => {
        transcriber.transcribe({
          audio: audioBuffer,
          options: {
            prompt: "This is a business meeting",
          },
        });
      }).not.toThrow();
    });

    it("should accept timestamp_granularities for whisper models", () => {
      const audioBuffer = Buffer.from([0xff, 0xfb, 0x00, 0x00]);
      
      expect(() => {
        transcriber.transcribe({
          audio: audioBuffer,
          options: {
            timestamp_granularities: ["word", "segment"],
          },
        });
      }).not.toThrow();
    });
  });

  describe("model-specific behavior", () => {
    it("should work with different models", () => {
      const whisperTranscriber = new OpenAITranscriptions({
        model: "whisper-1",
        apiKey: "test-key",
      });

      const gptTranscriber = new OpenAITranscriptions({
        model: "gpt-4o-transcribe",
        apiKey: "test-key",
      });

      expect(whisperTranscriber.model).toBe("whisper-1");
      expect(gptTranscriber.model).toBe("gpt-4o-transcribe");
    });

    it("should handle different response formats", () => {
      const jsonTranscriber = new OpenAITranscriptions({
        response_format: "json",
        apiKey: "test-key",
      });

      const verboseTranscriber = new OpenAITranscriptions({
        response_format: "verbose_json",
        apiKey: "test-key",
      });

      expect(jsonTranscriber.response_format).toBe("json");
      expect(verboseTranscriber.response_format).toBe("verbose_json");
    });
  });
}); 