import {
  Configuration,
  ConfigurationParameters,
  CreateTranscriptionResponse,
  OpenAIApi,
} from "openai";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";

const MODEL_NAME = "whisper-1";

export class OpenAIWhisperAudio extends BaseDocumentLoader {
  private readonly openAiApi: OpenAIApi;

  private readonly audioFile: File;

  constructor({
    openAIConfiguration,
    audioFile,
  }: {
    openAIConfiguration: ConfigurationParameters;
    audioFile: File;
  }) {
    super();
    this.openAiApi = new OpenAIApi(new Configuration(openAIConfiguration));
    this.audioFile = audioFile;
  }

  async load(): Promise<Document[]> {
    try {
      const response = await this.openAiApi.createTranscription(
        this.audioFile,
        MODEL_NAME
      );
      const transcriptionResponse: CreateTranscriptionResponse = response.data;
      const document = new Document({
        pageContent: transcriptionResponse.text,
        metadata: {
          fileName: this.audioFile.name,
        },
      });

      return [document];
    } catch (e) {
      throw new Error(
        `Failed to transcribe audio file. Error: ${(e as Error).message}`
      );
    }
  }
}
