import { type ClientOptions, OpenAIClient, toFile } from "@langchain/openai";

import { Document } from "@langchain/core/documents";
import { BufferLoader } from "./buffer.js";
import { logVersion020MigrationWarning } from "../../util/entrypoint_deprecation.js";

/* #__PURE__ */ logVersion020MigrationWarning({
  oldEntrypointName: "document_loaders/fs/openai_whisper_audio",
  newPackageName: "@langchain/community",
});

const MODEL_NAME = "whisper-1";

/**
 * @deprecated - Import from "@langchain/community/document_loaders/fs/openai_whisper_audio" instead. This entrypoint will be removed in 0.3.0.
 *
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
    metadata: Record<string, string>
  ): Promise<Document[]> {
    const fileName =
      metadata.source === "blob" ? metadata.blobType : metadata.source;
    const transcriptionResponse =
      await this.openAIClient.audio.transcriptions.create({
        file: await toFile(raw, fileName),
        model: MODEL_NAME,
      });
    const document = new Document({
      pageContent: transcriptionResponse.text,
      metadata,
    });
    return [document];
  }
}
