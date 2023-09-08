import { promises as fs } from "node:fs";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";
import { AssemblyAIClient } from "../../util/assemblyai-client.js";
import {
  AssemblyAIOptions,
  CreateTranscriptParams,
  SubtitleFormat,
  Transcript,
  TranscriptSegment,
} from "../../types/assemblyai-types.js";

export * from "../../types/assemblyai-types.js";

/**
 * Base class for AssemblyAI loaders.
 */
abstract class AssemblyAILoader extends BaseDocumentLoader {
  protected client: AssemblyAIClient;

  /**
   * Creates a new AssemblyAI loader.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(assemblyAIOptions?: AssemblyAIOptions) {
    super();
    const apiKey =
      assemblyAIOptions?.apiKey ?? getEnvironmentVariable("ASSEMBLYAI_API_KEY");
    this.client = new AssemblyAIClient(apiKey as string);
  }

  /**
   * Attempts to upload the file to AssemblyAI if it is a local file.
   * If `audio_url` starts with `http://` or `https://`, it is assumed to be a remote file.
   * Otherwise, it is assumed to be a local file and is uploaded to AssemblyAI.
   * @param createTranscriptOptions
   */
  protected async uploadFile(createTranscriptOptions: CreateTranscriptParams) {
    let path = createTranscriptOptions.audio_url;
    if (path.startsWith("http://") || path.startsWith("https://")) return;
    if (path.startsWith("file://")) path = path.slice("file://".length);

    const file = await fs.readFile(path);
    const uploadUrl = await this.client.uploadFile(file);
    // eslint-disable-next-line no-param-reassign
    createTranscriptOptions.audio_url = uploadUrl;
  }
}

abstract class CreateTranscriptLoader extends AssemblyAILoader {
  protected createTranscriptParams?: CreateTranscriptParams;

  protected transcriptId?: string;

  /**
   * Creates a new AudioTranscriptLoader.
   * @param createTranscriptParams The parameters to create the transcript.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    createTranscriptParams: CreateTranscriptParams,
    assemblyAIOptions?: AssemblyAIOptions
  );

  /**
   * Retrevies an existing transcript by its ID.
   * @param transcriptId The ID of the transcript to retrieve.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(transcriptId: string, assemblyAIOptions?: AssemblyAIOptions);

  /**
   * Retrevies an existing transcript by its ID.
   * @param params The parameters to create the transcript, or the ID of the transcript to retrieve.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    params: CreateTranscriptParams | string,
    assemblyAIOptions?: AssemblyAIOptions
  ) {
    super(assemblyAIOptions);
    if (typeof params === "string") {
      this.transcriptId = params;
    } else {
      this.createTranscriptParams = params;
    }
  }

  protected async getOrCreateTranscript() {
    if (!this.transcriptId && this.createTranscriptParams) {
      await this.uploadFile(this.createTranscriptParams);
      this.transcriptId = (
        await this.client.createTranscript(this.createTranscriptParams)
      ).id;
    }
    const transcript = await this.client.waitForTranscriptToComplete(
      this.transcriptId as string
    );
    return transcript;
  }
}

/**
 * Creates and loads the transcript as a document using AssemblyAI.
 */
export class AudioTranscriptLoader extends CreateTranscriptLoader {
  /**
   * Creates a transcript and loads the transcript as a document using AssemblyAI.
   * @returns A promise that resolves to a single document containing the transcript text
   * as the page content, and the transcript object as the metadata.
   */
  override async load(): Promise<Document<Transcript>[]> {
    const transcript = await this.getOrCreateTranscript();

    return [
      new Document({
        pageContent: transcript.text,
        metadata: transcript,
      }),
    ];
  }
}

/**
 * Creates a transcript and loads the paragraphs of the transcript, creating a document for each paragraph.
 */
export class AudioTranscriptParagraphsLoader extends CreateTranscriptLoader {
  /**
   * Creates a transcript and loads the paragraphs of the transcript, creating a document for each paragraph.
   * @returns A promise that resolves to an array of documents, each containing a paragraph of the transcript.
   */
  override async load(): Promise<Document<TranscriptSegment>[]> {
    const transcript = await this.getOrCreateTranscript();
    const paragraphsResponse = await this.client.getParagraphs(transcript.id);
    return paragraphsResponse.paragraphs.map(
      (p) =>
        new Document({
          pageContent: p.text,
          metadata: p,
        })
    );
  }
}

/**
 * Creates a transcript for the given `CreateTranscriptParams.audio_url`,
 * and loads the sentences of the transcript, creating a document for each sentence.
 */
export class AudioTranscriptSentencesLoader extends CreateTranscriptLoader {
  /**
   * Creates a transcript and loads the sentences of the transcript, creating a document for each sentence.
   * @returns A promise that resolves to an array of documents, each containing a sentence of the transcript.
   */
  override async load(): Promise<Document<TranscriptSegment>[]> {
    const transcript = await this.getOrCreateTranscript();
    const sentencesResponse = await this.client.getSentences(transcript.id);
    return sentencesResponse.sentences.map(
      (p) =>
        new Document({
          pageContent: p.text,
          metadata: p,
        })
    );
  }
}

/**
 * Creates a transcript and loads subtitles for the transcript as `srt` or `vtt` format.
 */
export class AudioSubtitleLoader extends CreateTranscriptLoader {
  /**
   * Creates a new AudioSubtitleLoader.
   * @param createTranscriptParams The parameters to create the transcript.
   * @param subtitleFormat The format of the subtitles, either `srt` or `vtt`.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    createTranscriptParams: CreateTranscriptParams,
    subtitleFormat: (typeof SubtitleFormat)[keyof typeof SubtitleFormat],
    assemblyAIOptions?: AssemblyAIOptions
  );

  /**
   * Creates a new AudioSubtitleLoader.
   * @param transcriptId The ID of the transcript to retrieve.
   * @param subtitleFormat The format of the subtitles, either `srt` or `vtt`.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    transcriptId: string,
    subtitleFormat: (typeof SubtitleFormat)[keyof typeof SubtitleFormat],
    assemblyAIOptions?: AssemblyAIOptions
  );

  /**
   * Creates a new AudioSubtitleLoader.
   * @param params The parameters to create the transcript, or the ID of the transcript to retrieve.
   * @param subtitleFormat The format of the subtitles, either `srt` or `vtt`.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    params: CreateTranscriptParams | string,
    private subtitleFormat: (typeof SubtitleFormat)[keyof typeof SubtitleFormat] = SubtitleFormat.Srt,
    assemblyAIOptions?: AssemblyAIOptions
  ) {
    super(params as string, assemblyAIOptions);
    this.subtitleFormat = subtitleFormat;
  }

  /**
   * Creates a transcript and loads subtitles for the transcript as `srt` or `vtt` format.
   * @returns A promise that resolves a document containing the subtitles as the page content.
   */
  override async load(): Promise<Document[]> {
    const transcript = await this.getOrCreateTranscript();
    const subtitles = await this.client.getSubtitles(
      transcript.id,
      this.subtitleFormat
    );

    return [
      new Document({
        pageContent: subtitles,
      }),
    ];
  }
}
