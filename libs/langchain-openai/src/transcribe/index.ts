import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { OpenAICoreRequestOptions } from "../types.js";
import { getEndpoint, OpenAIEndpointConfig } from "../utils/azure.js";
import { wrapOpenAIClientError } from "../utils/openai.js";

import { prepareAudioFile } from './utils.js'
import { DEFAULT_MODEL, DEFAULT_RESPONSE_FORMAT } from './constants.js'
import type {
  TranscriberInit, TranscribeModel, TimestampGranularity,
  ModelResponseFormat, TranscriptionRequest, TranscriptionResponseMap,
} from './types.js'

/**
 * Class for transcribing audio using the OpenAI Whisper API.
 */
export class OpenAITranscriptions<
  TModel extends TranscribeModel,
  TInitFormat extends ModelResponseFormat<TModel> = ModelResponseFormat<TModel>
> {
  lc_serializable = true;

  model: string;

  language?: string;

  prompt?: string;

  response_format: TInitFormat;

  temperature: number;

  timestamp_granularities?: TimestampGranularity[];

  timeout?: number;

  organization?: string;

  /**
   * The async caller should be used to make any async calls,
   * which will thus benefit from the concurrency and retry logic.
   */
  caller: AsyncCaller;

  protected client: OpenAIClient;

  protected clientConfig: ClientOptions;

  constructor(config: TranscriberInit<TModel, TInitFormat>) {
    const fieldsWithDefaults = { maxConcurrency: 2, ...config };

    this.caller = new AsyncCaller(fieldsWithDefaults ?? {});

    const apiKey =
      fieldsWithDefaults?.apiKey ??
      fieldsWithDefaults?.openAIApiKey ??
      getEnvironmentVariable("OPENAI_API_KEY");

    this.organization =
      fieldsWithDefaults?.configuration?.organization ??
      getEnvironmentVariable("OPENAI_ORGANIZATION");

    this.model = fieldsWithDefaults?.model ?? DEFAULT_MODEL;
    this.language = fieldsWithDefaults?.language;
    this.prompt = fieldsWithDefaults?.prompt;
    this.response_format = fieldsWithDefaults?.response_format as TInitFormat ?? DEFAULT_RESPONSE_FORMAT;
    this.temperature = fieldsWithDefaults?.temperature ?? 0;
    this.timestamp_granularities = fieldsWithDefaults?.timestamp_granularities;
    this.timeout = fieldsWithDefaults?.timeout;

    this.clientConfig = {
      apiKey,
      organization: this.organization,
      dangerouslyAllowBrowser: true,
      ...config?.configuration,
    };
  }

  /**
   * Transcribes audio files to text using OpenAI's speech-to-text models.
   * 
   * This method supports various audio formats (MP3, WAV, FLAC, etc.) and can automatically
   * detect the file type. The transcription uses the instance's configured response format
   * and other settings, which can be overridden per request.
   * 
   * @param request - The transcription request configuration
   * @param request.audio - Audio data as Buffer, File, or Uint8Array
   * @param request.filename - Optional filename for the audio (helps with format detection)
   * @param request.options - Optional request-specific overrides
   * @param request.options.language - ISO-639-1 language code (e.g., 'en', 'es', 'fr') of the audio
   * @param request.options.prompt - Optional text prompt to guide the model's style
   * @param request.options.temperature - Sampling temperature (0-1, lower = more consistent)
   * @param request.options.timestamp_granularities - Granularity for timestamps (whisper-1 only)
   * 
   * @returns Promise resolving to transcription response with text and optional metadata
   * 
   * @example
   * ```typescript
   * import fs from 'node:fs/promises';
   * import { OpenAITranscriptions } from '@langchain/openai';
   * 
   * const transcriber = new OpenAITranscriptions({
   *   model: 'whisper-1',
   *   response_format: 'json'
   * });
   * 
   * // Basic transcription
   * const audioBuffer = await fs.readFile('audio.mp3');
   * const result = await transcriber.transcribe({
   *   audio: audioBuffer
   * });
   * console.log(result.text);
   * 
   * // With language and temperature options
   * const result2 = await transcriber.transcribe({
   *   audio: audioBuffer
   *   options: {
   *     language: 'es',
   *     temperature: 0.2,
   *     prompt: 'This is a business meeting transcript.'
   *   }
   * });
   * ```
   * 
   * @throws {Error} When audio format cannot be detected and no filename is provided
   * @throws {Error} When the audio type is unsupported
   */
  async transcribe<
    TCallFormat extends ModelResponseFormat<TModel> = TInitFormat
  >(
    request: TranscriptionRequest<TModel, TCallFormat>
  ): Promise<TranscriptionResponseMap[TCallFormat]> {
    const { audio, filename, options: requestOptions } = request;

    // Merge instance options with request-specific options
    const mergedOptions = {
      model: this.model,
      language: requestOptions?.language ?? this.language,
      prompt: requestOptions?.prompt ?? this.prompt,
      response_format: requestOptions?.response_format ?? this.response_format, // Always use instance format
      temperature: requestOptions?.temperature ?? this.temperature,
      timestamp_granularities: requestOptions?.timestamp_granularities ?? this.timestamp_granularities,
    };

    const params: OpenAIClient.Audio.TranscriptionCreateParams = {
      model: mergedOptions.model,
      file: await prepareAudioFile(audio, filename),
      ...(mergedOptions.language && { language: mergedOptions.language }),
      ...(mergedOptions.prompt && { prompt: mergedOptions.prompt }),
      ...(mergedOptions.response_format && { response_format: mergedOptions.response_format }),
      ...(mergedOptions.temperature !== undefined && { temperature: mergedOptions.temperature }),
      ...(mergedOptions.timestamp_granularities && { timestamp_granularities: mergedOptions.timestamp_granularities }),
    };

    const transcriptionResponse = await this.#transcriptionWithRetry(params);

    // Handle different response formats
    if (typeof transcriptionResponse === "string") {
      return { text: transcriptionResponse } as unknown as TranscriptionResponseMap[TCallFormat]
    }

    // For verbose_json format, the response includes additional metadata
    return transcriptionResponse as TranscriptionResponseMap[TCallFormat];
  }

  /**
   * Private method to make a request to the OpenAI API for transcription.
   * Handles the retry logic and returns the response from the API.
   * @param request Request to send to the OpenAI API.
   * @returns Promise that resolves to the response from the API.
   */
  async #transcriptionWithRetry(
    request: OpenAIClient.Audio.TranscriptionCreateParams
  ): Promise<OpenAIClient.Audio.Transcription> {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        baseURL: this.clientConfig.baseURL,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

      const params = {
        ...this.clientConfig,
        baseURL: endpoint,
        timeout: this.timeout,
        maxRetries: 0,
      };

      if (!params.baseURL) {
        delete params.baseURL;
      }

      this.client = new OpenAIClient(params);
    }

    const requestOptions: OpenAICoreRequestOptions<OpenAIClient.Audio.TranscriptionCreateParams> = {};

    return this.caller.call(async () => {
      try {
        return await this.client.audio.transcriptions.create(
          request as OpenAIClient.Audio.TranscriptionCreateParamsNonStreaming,
          requestOptions
        );
      } catch (e) {
        const error = wrapOpenAIClientError(e);
        throw error;
      }
    });
  }

  /**
   * Get the identifying parameters for the model
   */
  _identifyingParams(): Record<string, unknown> {
    return {
      model_name: this.model,
      model: this.model,
      language: this.language,
      prompt: this.prompt,
      response_format: this.response_format,
      temperature: this.temperature,
      timestamp_granularities: this.timestamp_granularities,
      ...this.clientConfig,
    };
  }

  /**
   * Get the type of language model
   */
  _llmType() {
    return "openai-transcriptions";
  }

  /**
   * Serialize the model to JSON
   */
  serialize(): object {
    return {
      ...this._identifyingParams(),
      _type: this._llmType(),
    };
  }

  static lc_name() {
    return "OpenAITranscriptions";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      openAIApiKey: "OPENAI_API_KEY",
      apiKey: "OPENAI_API_KEY",
      organization: "OPENAI_ORGANIZATION",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      openAIApiKey: "openai_api_key",
      apiKey: "openai_api_key",
    };
  }
}

export * from './types.js'