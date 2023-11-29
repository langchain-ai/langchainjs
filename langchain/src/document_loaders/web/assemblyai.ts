import {
  AssemblyAI,
  BaseServiceParams,
  TranscribeParams,
  SubtitleFormat,
  Transcript,
  TranscriptParagraph,
  TranscriptSentence,
  CreateTranscriptParameters,
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
   * Create a new AssemblyAI loader.
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
  protected transcribeParams?: TranscribeParams | CreateTranscriptParameters;

  protected transcriptId?: string;

  /**
   * Transcribe audio or retrieve an existing transcript by its ID.
   * @param params The parameters to transcribe audio, or the ID of the transcript to retrieve.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    params: TranscribeParams | CreateTranscriptParameters | string,
    assemblyAIOptions?: AssemblyAIOptions
  ) {
    super(assemblyAIOptions);
    if (typeof params === "string") {
      this.transcriptId = params;
    } else {
      this.transcribeParams = params;
    }
  }

  protected async transcribeOrGetTranscript() {
    if (this.transcriptId) {
      return await this.client.transcripts.get(this.transcriptId);
    }
    if (this.transcribeParams) {
      let transcribeParams: TranscribeParams;
      if ("audio_url" in this.transcribeParams) {
        transcribeParams = {
          ...this.transcribeParams,
          audio: this.transcribeParams.audio_url,
        };
      } else {
        transcribeParams = this.transcribeParams;
      }

      return await this.client.transcripts.transcribe(transcribeParams);
    } else {
      throw new Error("No transcript ID or transcribe parameters provided");
    }
  }
}

/**
 * Transcribe audio and load the transcript as a document using AssemblyAI.
 */
export class AudioTranscriptLoader extends CreateTranscriptLoader {
  /**
   * Transcribe audio and load the transcript as a document using AssemblyAI.
   * @returns A promise that resolves to a single document containing the transcript text
   * as the page content, and the transcript object as the metadata.
   */
  override async load(): Promise<Document<Transcript>[]> {
    const transcript = await this.transcribeOrGetTranscript();

    return [
      new Document({
        pageContent: transcript.text as string,
        metadata: transcript,
      }),
    ];
  }
}

/**
 * Transcribe audio and load the paragraphs of the transcript, creating a document for each paragraph.
 */
export class AudioTranscriptParagraphsLoader extends CreateTranscriptLoader {
  /**
   * Transcribe audio and load the paragraphs of the transcript, creating a document for each paragraph.
   * @returns A promise that resolves to an array of documents, each containing a paragraph of the transcript.
   */
  override async load(): Promise<Document<TranscriptParagraph>[]> {
    const transcript = await this.transcribeOrGetTranscript();
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
 * Transcribe audio and load the sentences of the transcript, creating a document for each sentence.
 */
export class AudioTranscriptSentencesLoader extends CreateTranscriptLoader {
  /**
   * Transcribe audio and load the sentences of the transcript, creating a document for each sentence.
   * @returns A promise that resolves to an array of documents, each containing a sentence of the transcript.
   */
  override async load(): Promise<Document<TranscriptSentence>[]> {
    const transcript = await this.transcribeOrGetTranscript();
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
 * Transcribe audio and load subtitles for the transcript as `srt` or `vtt` format.
 */
export class AudioSubtitleLoader extends CreateTranscriptLoader {
  /**
   * Create a new AudioSubtitleLoader.
   * @param transcribeParams The parameters to transcribe audio.
   * @param subtitleFormat The format of the subtitles, either `srt` or `vtt`.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    transcribeParams: TranscribeParams | CreateTranscriptParameters,
    subtitleFormat: SubtitleFormat,
    assemblyAIOptions?: AssemblyAIOptions
  );

  /**
   * Create a new AudioSubtitleLoader.
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
   * Create a new AudioSubtitleLoader.
   * @param params The parameters to transcribe audio, or the ID of the transcript to retrieve.
   * @param subtitleFormat The format of the subtitles, either `srt` or `vtt`.
   * @param assemblyAIOptions The options to configure the AssemblyAI loader.
   * Configure the `assemblyAIOptions.apiKey` with your AssemblyAI API key, or configure it as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  constructor(
    params: TranscribeParams | CreateTranscriptParameters | string,
    private subtitleFormat: SubtitleFormat = "srt",
    assemblyAIOptions?: AssemblyAIOptions
  ) {
    super(params, assemblyAIOptions);
    this.subtitleFormat = subtitleFormat;
  }

  /**
   * Transcribe audio and load subtitles for the transcript as `srt` or `vtt` format.
   * @returns A promise that resolves a document containing the subtitles as the page content.
   */
  override async load(): Promise<Document[]> {
    const transcript = await this.transcribeOrGetTranscript();
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
