import { SonixSpeechRecognitionService } from "sonix-speech-recognition";
import { SpeechToTextRequest } from "sonix-speech-recognition/lib/types.js";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

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

  async load(): Promise<Document[]> {
    const { text, status, error } =
      await this.sonixSpeechRecognitionService.speechToText(
        this.speechToTextRequest
      );

    if (status === "failed") {
      console.error("Error:", error);
      return [];
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
