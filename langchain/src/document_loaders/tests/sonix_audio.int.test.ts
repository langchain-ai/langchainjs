/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, jest, expect } from "@jest/globals";
import { SonixSpeechRecognitionService } from "sonix-speech-recognition";
import {
  SpeechToTextRequest,
  SpeechToTextResponse,
} from "sonix-speech-recognition/lib/types.js";
import { SonixAudioTranscriptionLoader } from "../web/sonix_audio.js";

jest.mock("sonix-speech-recognition");

describe("SonixAudioTranscriptionLoader", () => {
  let sonixSpeechRecognitionService: SonixSpeechRecognitionService;
  let speechToTextRequest: SpeechToTextRequest;
  let sonixAudioTranscriptionLoader: SonixAudioTranscriptionLoader;

  beforeEach(() => {
    sonixSpeechRecognitionService = new SonixSpeechRecognitionService(
      "auth-key"
    );
    speechToTextRequest = {
      fileName: "test.mp3",
      language: "en",
      audioFilePath: "./test.mp3",
    };
    sonixAudioTranscriptionLoader = new SonixAudioTranscriptionLoader({
      sonixAuthKey: "auth-key",
      request: speechToTextRequest,
    });
    (sonixAudioTranscriptionLoader as any).sonixSpeechRecognitionService =
      sonixSpeechRecognitionService;
  });

  test("should initialize properly", () => {
    expect(sonixAudioTranscriptionLoader).toBeDefined();
  });

  describe("load", () => {
    test("should return a document when transcription is successful", async () => {
      const response: SpeechToTextResponse = {
        jobId: "job-id",
        text: "test transcription",
        status: "completed",
      };
      sonixSpeechRecognitionService.speechToText = jest
        .fn<() => Promise<SpeechToTextResponse>>()
        .mockResolvedValue(response);

      const documents = await sonixAudioTranscriptionLoader.load();

      expect(documents).toHaveLength(1);
      expect(documents[0].pageContent).toBe(response.text);
      expect(documents[0].metadata.fileName).toBe(speechToTextRequest.fileName);
    });

    test("should throw when transcription fails", async () => {
      const response: SpeechToTextResponse = {
        jobId: "job-id",
        text: "",
        status: "failed",
        error: "Error message",
      };
      sonixSpeechRecognitionService.speechToText = jest
        .fn<() => Promise<SpeechToTextResponse>>()
        .mockResolvedValue(response);

      await expect(sonixAudioTranscriptionLoader.load()).rejects.toThrow();
    });
  });
});
