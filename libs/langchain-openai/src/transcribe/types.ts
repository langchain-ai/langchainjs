import { type ClientOptions } from "openai";
import { AsyncCallerParams } from "@langchain/core/utils/async_caller";

import { WHISPER_RESPONSE_FORMATS, GPT_RESPONSE_FORMATS, DEFAULT_TIMESTAMP_GRANULARITIES } from "./constants.js";

// Helper type for literal union (preserves literals while allowing extensions)
type LiteralUnion<T extends U, U = string> = T | (U & Record<string, never>);
type VoiceToTextModelIds = LiteralUnion<"whisper-1" | "gpt-4o-mini-transcribe" | "gpt-4o-transcribe">;

export type WhisperResponseFormat = (typeof WHISPER_RESPONSE_FORMATS)[number];
export type GPTResponseFormat = (typeof GPT_RESPONSE_FORMATS)[number];
export type TimestampGranularity = (typeof DEFAULT_TIMESTAMP_GRANULARITIES)[number];

/**
 * Configuration for OpenAI Transcriptions with model-specific response format constraints
 */
export type TranscriptionConfig<M extends VoiceToTextModelIds = VoiceToTextModelIds> = {
    model?: M;
    language?: string;
    prompt?: string;
    response_format?: M extends "whisper-1"
        ? LiteralUnion<WhisperResponseFormat>
        : M extends "gpt-4o-mini-transcribe" | "gpt-4o-transcribe"
            ? LiteralUnion<GPTResponseFormat>
            : LiteralUnion<WhisperResponseFormat>; // Default for unknown models
    temperature?: number;
    timestamp_granularities?: M extends "whisper-1" ? TimestampGranularity[] : never;
    timeout?: number;
    verbose?: boolean;
    openAIApiKey?: string;
    apiKey?: string;
    configuration?: ClientOptions;
} & AsyncCallerParams;

/**
 * Base response from transcription API
 */
export interface BaseTranscriptionResponse {
    /**
     * The transcribed text
     */
    text: string;
}

/**
 * Extended response with metadata (verbose_json format)
 */
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
    segments?: Array<{
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
    }>;
}

/**
 * Smart response type that infers based on model and response format
 */
export type TranscriptionResponse<C extends TranscriptionConfig> =
  C["model"] extends "whisper-1"
    ? C["response_format"] extends "verbose_json"
      ? VerboseTranscriptionResponse
      : BaseTranscriptionResponse
    : C["model"] extends "gpt-4o-mini-transcribe" | "gpt-4o-transcribe"
    ? C["response_format"] extends "verbose_json"
      ? BaseTranscriptionResponse // GPT models don't support verbose_json
      : BaseTranscriptionResponse
    : C["response_format"] extends "verbose_json"
    ? VerboseTranscriptionResponse
    : BaseTranscriptionResponse;

export type AudioInput = Buffer | File | Uint8Array | Blob | Promise<Buffer | File | Uint8Array | Blob>;