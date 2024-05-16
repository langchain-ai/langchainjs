import { SonixSpeechRecognitionService } from "sonix-speech-recognition";
import { SpeechToTextRequest } from "sonix-speech-recognition/lib/types.js";
import { Document } from "@langchain/core/documents";
import { BaseDocumentLoader } from "../base.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/web/sonix_audio",
  newPackageName: "@langchain/community",
});

/**
 * @deprecated - Import from "@langchain/community/document_loaders/web/sonix_audio" instead. This entrypoint will be removed in 0.3.0.
 * 
 * A class that represents a document loader for transcribing audio files
 * using the Sonix Speech Recognition service.
 * @example
 * ```typescript
 * const loader = new SonixAudioTranscriptionLoader({
 *   sonixAuthKey: "SONIX_AUTH_KEY",
 *   request: {
 *     audioFilePath: "LOCAL_AUDIO_FILE_PATH",
 *     fileName: "FILE_NAME",
 *     language: "en",
 *   },
 * });
 * const docs = await loader.load();
 * ```
 */
export class SonixAudioTranscriptionLoader extends BaseDocumentLoader {
  private readonly sonixSpeechRecognitionService: SonixSpeechRecognitionService;

  private readonly speechToTextRequest: SpeechToTextRequest;

  constructor({
    sonixAuthKey,
    request: speechToTextRequest,
  }: {
    sonixAuthKey: string;
    request: SpeechToTextRequest;
  }) {
    super();
    this.sonixSpeechRecognitionService = new SonixSpeechRecognitionService(
      sonixAuthKey
    );
    this.speechToTextRequest = speechToTextRequest;
  }

  /**
   * Performs the speech-to-text transcription using the
   * SonixSpeechRecognitionService and returns the transcribed text as a
   * Document object.
   * @returns An array of Document objects containing the transcribed text.
   */
  async load(): Promise<Document[]> {
    const { text, status, error } =
      await this.sonixSpeechRecognitionService.speechToText(
        this.speechToTextRequest
      );

    if (status === "failed") {
      throw new Error(`Failed to transcribe audio file. Error: ${error}`);
    }

    const document = new Document({
      pageContent: text,
      metadata: {
        fileName: this.speechToTextRequest.fileName,
      },
    });

    return [document];
  }
}
