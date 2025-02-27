import { type ClientOptions, OpenAIClient, toFile } from "@langchain/openai";

import { Document } from "@langchain/core/documents";
import { BufferLoader } from "langchain/document_loaders/fs/buffer";

const MODEL_NAME = "whisper-1";

/**
 * @example
 * ```typescript
 * const loader = new OpenAIWhisperAudio(
 *   "./src/document_loaders/example_data/test.mp3",
 * );
 * const docs = await loader.load();
 * console.log(docs);
 * ```
 */
export class OpenAIWhisperAudio extends BufferLoader {
  private readonly openAIClient: OpenAIClient;

  private readonly transcriptionCreateParams?: Partial<OpenAIClient.Audio.TranscriptionCreateParams>;

  constructor(
    filePathOrBlob: string | Blob,
    fields?: {
      clientOptions?: ClientOptions;
      transcriptionCreateParams?: Partial<OpenAIClient.Audio.TranscriptionCreateParams>;
    }
  ) {
    super(filePathOrBlob);
    this.openAIClient = new OpenAIClient(fields?.clientOptions);
    this.transcriptionCreateParams = fields?.transcriptionCreateParams ?? {};
  }

  protected async parse(
    raw: Buffer,
    metadata: Record<string, string>
  ): Promise<Document[]> {
    const fileName =
      metadata.source === "blob" ? metadata.blobType : metadata.source;
    const transcriptionResponse =
      await this.openAIClient.audio.transcriptions.create({
        file: await toFile(raw, fileName),
        model: MODEL_NAME,
        ...this.transcriptionCreateParams,
      });
    const document = new Document({
      pageContent: transcriptionResponse.text,
      metadata,
    });
    return [document];
  }
}
