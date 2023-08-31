import ffmpeg from "fluent-ffmpeg";
import { Readable, PassThrough } from "stream";
import OpenAI, { toFile, ClientOptions } from "openai";
import { BufferLoader } from "./buffer.js";
import { Document } from "../../document.js";

const MODEL_NAME = "whisper-1";

async function extractAudio(rawVideo: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const videoStream = Readable.from(rawVideo);
    const audioStream = new PassThrough();
    ffmpeg()
      .input(videoStream)
      .audioCodec("pcm_s16le")
      .toFormat("wav")
      .audioChannels(1)
      .on("error", (err) => {
        reject(err);
      })
      .pipe(audioStream, { end: true });

    const audioData: Uint8Array[] = [];
    audioStream
      .on("data", (chunk) => {
        audioData.push(chunk);
      })
      .on("end", () => {
        const audioBuffer = Buffer.concat(audioData);
        resolve(audioBuffer);
      });
  });
}

/**
 * A class that extends the `BufferLoader` class. It represents a document
 * loader that loads transcription from video files using OpenAI Whisper.
 */
export class OpenAIWhisperVideo extends BufferLoader {
  private readonly openAiApi: OpenAI;

  constructor(
    filePathOrBlob: string | Blob,
    openAIConfiguration: ClientOptions
  ) {
    super(filePathOrBlob);
    this.openAiApi = new OpenAI(openAIConfiguration);
  }

  /**
   * A method that takes a `raw` buffer and `metadata` as parameters and
   * returns a promise that resolves to an array of `Document` instances.
   * It uses the `fluent-ffmpeg` module to extract audio buffer from video buffer.
   * Then audio buffer sends to Whisper API to renurn raw text trancription.
   * Creates a new `Document` instance with the extracted transcription and the provided
   * metadata, and returns it as an array.
   * @param raw The raw buffer from which to extract text content.
   * @param metadata The metadata to be associated with the created `Document` instance.
   * @returns A promise that resolves to an array of `Document` instances.
   */
  public async parse(
    raw: Buffer,
    metadata: Document["metadata"]
  ): Promise<Document[]> {
    const buffer = await extractAudio(raw);
    const transcriptionResponse =
      await this.openAiApi.audio.transcriptions.create({
        file: await toFile(buffer, "input.wav"),
        model: MODEL_NAME,
      });

    const document = new Document({
      pageContent: transcriptionResponse.text,
      metadata,
    });

    return [document];
  }
}
