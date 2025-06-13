import { type ClientOptions } from "openai";

import { WHISPER_RESPONSE_FORMATS, GPT_RESPONSE_FORMATS, DEFAULT_TIMESTAMP_GRANULARITIES } from "./constants.js";

export type WhisperResponseFormat = (typeof WHISPER_RESPONSE_FORMATS)[number];
export type GPTResponseFormat = (typeof GPT_RESPONSE_FORMATS)[number];
export type TimestampGranularity = (typeof DEFAULT_TIMESTAMP_GRANULARITIES)[number];
export type TranscribeModel = "whisper-1" | "gpt-4o-mini-transcribe" | "gpt-4o-transcribe";

export type ModelResponseFormat<TModel extends TranscribeModel> =
    TModel extends "whisper-1" ? WhisperResponseFormat : GPTResponseFormat;

export interface TranscriberBaseOptions {
    temperature?: number;
    prompt?: string;
    language?: string;
}

export interface TranscriberInit<
    TModel extends TranscribeModel,
    TFormat extends ModelResponseFormat<TModel> = ModelResponseFormat<TModel>
> extends TranscriberBaseOptions {
    model?: TModel;
    language?: string;
    prompt?: string;
    response_format?: TFormat;
    temperature?: number;
    timestamp_granularities?: TFormat extends "whisper-1" ? TimestampGranularity[] : never;
    timeout?: number;
    verbose?: boolean;
    openAIApiKey?: string;
    apiKey?: string;
    configuration?: ClientOptions;
}

export interface TranscriptionRequest<
    TModel extends TranscribeModel,
    TFormat extends ModelResponseFormat<TModel> = ModelResponseFormat<TModel>
> {
    audio: Uint8Array | File;
    filename?: string;
    options?: {
        response_format?: TFormat;
        temperature?: number;
        prompt?: string;
        language?: string;
        timestamp_granularities?: Array<"word" | "segment">;
    };
}

export interface BaseTranscriptionResponse {
  text: string;
}

export interface VerboseTranscriptionResponse extends BaseTranscriptionResponse {
  /**
   * Additional metadata (only available with verbose_json format)
   */
  task?: string;
  language?: string;
  duration?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
  segments: {
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }[];
}

export type TranscriptionResponseMap = {
  text: BaseTranscriptionResponse;
  json: BaseTranscriptionResponse;
  verbose_json: VerboseTranscriptionResponse;
  srt: BaseTranscriptionResponse;
  vtt: BaseTranscriptionResponse;
  verbose_srt: BaseTranscriptionResponse;
  verbose_vtt: BaseTranscriptionResponse;
};

export type AudioInput = Buffer | File | Uint8Array | Blob | Promise<Buffer | File | Uint8Array | Blob>;