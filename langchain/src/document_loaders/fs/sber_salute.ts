import {
  AudioEncoding,
  SberSaluteSpeechRecognitionService,
} from "sber-salute-speech-recognition";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

interface SberSaluteConfig {
  sberSaluteAuthKey: string;
  pathToAudioFile: string;
  audioEncoding: string;
}

export class SberSaluteAudioTranscriptionLoader extends BaseDocumentLoader {
  private readonly sberSaluteSpeechRecognitionService: SberSaluteSpeechRecognitionService;

  private readonly pathToAudioFile: string;

  private readonly audioEncoding: AudioEncoding;

  constructor({
    sberSaluteAuthKey,
    pathToAudioFile,
    audioEncoding,
  }: SberSaluteConfig) {
    super();
    this.sberSaluteSpeechRecognitionService =
      new SberSaluteSpeechRecognitionService(sberSaluteAuthKey);
    this.pathToAudioFile = pathToAudioFile;
    this.audioEncoding =
      AudioEncoding[audioEncoding as keyof typeof AudioEncoding];
  }

  async load(): Promise<Document[]> {
    const { text } = await this.sberSaluteSpeechRecognitionService.speechToText(
      this.pathToAudioFile,
      this.audioEncoding
    );

    const document = new Document({
      pageContent: text,
      metadata: {
        fileName: this.pathToAudioFile,
      },
    });

    return [document];
  }
}
