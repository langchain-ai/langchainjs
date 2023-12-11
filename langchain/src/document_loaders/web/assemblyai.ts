import {
  AssemblyAI,
  BaseServiceParams,
  CreateTranscriptParameters,
  SubtitleFormat,
  Transcript,
  TranscriptParagraph,
  TranscriptSentence,
} from "assemblyai";
import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";
import { AssemblyAIOptions } from "../../types/assemblyai-types.js";

export type * from "../../types/assemblyai-types.js";

/**
 * Base class for AssemblyAI loaders.
 */
abstract class AssemblyAILoader extends BaseDocumentLoader {
  protected client: AssemblyAI;

  /**
   * Creates a new AssemblyAI loader.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(assemblyAIOptions?: AssemblyAIOptions) {
    super();
    let options = assemblyAIOptions;
    if (!options) {
      options = {};
    }
    if (!options.apiKey) {
      options.apiKey = getEnvironmentVariable("ASSEMBLYAI_API_KEY");
    }
    if (!options.apiKey) {
      throw new Error("No AssemblyAI API key provided");
    }

    this.client = new AssemblyAI(options as BaseServiceParams);
  }
}

abstract class CreateTranscriptLoader extends AssemblyAILoader {
  protected CreateTranscriptParameters?: CreateTranscriptParameters;

  protected transcriptId?: string;

  /**
   * Retrevies an existing transcript by its ID.
   * @param params The parameters to create the transcript, or the ID of the transcript to retrieve.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    params: CreateTranscriptParameters | string,
    assemblyAIOptions?: AssemblyAIOptions
  ) {
    super(assemblyAIOptions);
    if (typeof params === "string") {
      this.transcriptId = params;
    } else {
      this.CreateTranscriptParameters = params;
    }
  }

  protected async getOrCreateTranscript() {
    if (this.transcriptId) {
      return await this.client.transcripts.get(this.transcriptId);
    }
    if (this.CreateTranscriptParameters) {
      return await this.client.transcripts.create(
        this.CreateTranscriptParameters
      );
    }
  }
}

/**
 * Creates and loads the transcript as a document using AssemblyAI.
 * @example
 * ```typescript
 * const loader = new AudioTranscriptLoader(
 *   { audio_url: "https:
 *   { apiKey: "ASSEMBLYAI_API_KEY" },
 * );
 * const docs = await loader.load();
 * console.dir(docs, { depth: Infinity });
 * ```
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
  override async load(): Promise<Document<TranscriptParagraph>[]> {
    const transcript = await this.getOrCreateTranscript();
    const paragraphsResponse = await this.client.transcripts.paragraphs(
      transcript.id
    );
    return paragraphsResponse.paragraphs.map(
      (p: TranscriptParagraph) =>
        new Document({
          pageContent: p.text,
          metadata: p,
        })
    );
  }
}

/**
 * Creates a transcript for the given `CreateTranscriptParameters.audio_url`,
 * and loads the sentences of the transcript, creating a document for each sentence.
 */
export class AudioTranscriptSentencesLoader extends CreateTranscriptLoader {
  /**
   * Creates a transcript and loads the sentences of the transcript, creating a document for each sentence.
   * @returns A promise that resolves to an array of documents, each containing a sentence of the transcript.
   */
  override async load(): Promise<Document<TranscriptSentence>[]> {
    const transcript = await this.getOrCreateTranscript();
    const sentencesResponse = await this.client.transcripts.sentences(
      transcript.id
    );
    return sentencesResponse.sentences.map(
      (p: TranscriptSentence) =>
        new Document({
          pageContent: p.text,
          metadata: p,
        })
    );
  }
}

/**
 * Creates a transcript and loads subtitles for the transcript as `srt` or `vtt` format.
 * @example
 * ```typescript
 * const loader = new AudioSubtitleLoader(
 *   {
 *     audio_url: "https:
 *   },
 *   "srt",
 *   {
 *     apiKey: "<ASSEMBLYAI_API_KEY>",
 *   },
 * );
 *
 *
 * const docs = await loader.load();
 * ```
 */
export class AudioSubtitleLoader extends CreateTranscriptLoader {
  /**
   * Creates a new AudioSubtitleLoader.
   * @param CreateTranscriptParameters The parameters to create the transcript.
   * @param subtitleFormat The format of the subtitles, either `srt` or `vtt`.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    CreateTranscriptParameters: CreateTranscriptParameters,
    subtitleFormat: SubtitleFormat,
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
    subtitleFormat: SubtitleFormat,
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
    params: CreateTranscriptParameters | string,
    private subtitleFormat: SubtitleFormat = "srt",
    assemblyAIOptions?: AssemblyAIOptions
  ) {
    super(params, assemblyAIOptions);
    this.subtitleFormat = subtitleFormat;
  }

  /**
   * Creates a transcript and loads subtitles for the transcript as `srt` or `vtt` format.
   * @returns A promise that resolves a document containing the subtitles as the page content.
   */
  override async load(): Promise<Document[]> {
    const transcript = await this.getOrCreateTranscript();
    const subtitles = await this.client.transcripts.subtitles(
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
