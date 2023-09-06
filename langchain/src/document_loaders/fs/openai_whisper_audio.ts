import { type ClientOptions, OpenAI as OpenAIClient, toFile } from "openai";
import * as path from "path";

import { Document } from "../../document.js";
import { BufferLoader } from "./buffer.js";

const MODEL_NAME = "whisper-1";

export class OpenAIWhisperAudio extends BufferLoader {
  private readonly openAIClient: OpenAIClient;

  constructor(
    filePathOrBlob: string | Blob,
    fields?: {
      clientOptions?: ClientOptions;
    }
  ) {
    super(filePathOrBlob);
    this.openAIClient = new OpenAIClient(fields?.clientOptions);
  }

  protected async parse(
    raw: Buffer,
    metadata: Record<string, any>
  ): Promise<Document<Record<string, any>>[]> {
    const fileName =
      metadata.source === "blob" ? metadata.blobType : metadata.source;
    const pathSegments = fileName.split(path.sep);
    const transcriptionResponse =
      await this.openAIClient.audio.transcriptions.create({
        file: await toFile(raw, pathSegments[pathSegments.length - 1]),
        model: MODEL_NAME,
      });
    const document = new Document({
      pageContent: transcriptionResponse.text,
      metadata,
    });
    return [document];
  }
}
