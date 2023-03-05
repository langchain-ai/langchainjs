import { Configuration, OpenAIApi, ConfigurationParameters } from "openai";
import { backOff } from "exponential-backoff";
import fetchAdapter from "../util/axios-fetch-adapter.js";
import { LLMCallbackManager } from "./index.js";

interface ModelParams {
  /** The sampling temperature, between 0 and 1. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. If set to 0, the model will use [log probability](https://en.wikipedia.org/wiki/Log_probability) to automatically increase the temperature until certain thresholds are hit. */
  temperature: number;

  /** ID of the model to use. Only 'whisper-1' is currently available. */
  model: string;

  /** One of: json, text, srt, verbose_json, or vtt. */
  responseFormat?: string;

  /** Maximum number of retries to make when generating */
  maxRetries?: number;
}

/**
 * Input to OpenAIWhisper class.
 * @augments ModelParams
 */
interface OpenAIInput extends ModelParams {
  /** The audio file: mp3, mp4, mpeg, mpga, m4a, wav, or webm. */
  file: Blob;

  /** An optional text to guide the model's style or continue a previous audio segment */
  prompt?: string;

  /** The language of the input audio. Supplying the input language in [ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) format will improve accuracy and latency. */
  language?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Kwargs = Record<string, any>;

/**
 * Wrapper around OpenAI large language models that use the Whisper endpoint.
 *
 * To use you should have the `openai` package installed, with the
 * `OPENAI_API_KEY` environment variable set.
 *
 * @remarks
 * Any parameters that are valid to be passed to {@link
 * https://platform.openai.com/docs/guides/speech-to-text |
 * `openai.createTranscription`} can be passed through {@link modelKwargs}, even
 * if not explicitly available on this class.
 *
 * @augments BaseLLM
 * @augments OpenAIInput
 */
export class OpenAIWhisper implements ModelParams {
  temperature = 1;

  model = "whisper-1";

  responseFormat = "text";

  maxRetries = 3;

  modelKwargs?: Kwargs;

  private clientConfig: ConfigurationParameters;

  private batchClient: OpenAIApi;

  constructor(
    fields?: Partial<ModelParams> & {
      callbackManager?: LLMCallbackManager;
      concurrency?: number;
      cache?: boolean;
      verbose?: boolean;
      openAIApiKey?: string;
    },
    configuration?: ConfigurationParameters
  ) {
    const apiKey = fields?.openAIApiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key not found");
    }

    this.model = fields?.model ?? this.model;
    this.temperature = fields?.temperature ?? this.temperature;
    this.responseFormat = fields?.responseFormat ?? this.responseFormat;

    this.clientConfig = {
      apiKey: fields?.openAIApiKey ?? process.env.OPENAI_API_KEY,
      ...configuration,
    };
  }

  /**
   * Get the parameters used to invoke the model
   */
  invocationParams(): ModelParams & Kwargs {
    return {
      model: this.model,
      temperature: this.temperature,
      responseFormat: this.responseFormat,
      maxRetries: this.maxRetries,
    };
  }

  _identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  /**
   * Get the identifying parameters for the model
   */
  identifyingParams() {
    return {
      model_name: this.model,
      ...this.invocationParams(),
      ...this.clientConfig,
    };
  }

  /**
   * Call out to OpenAI's endpoint with k unique prompts
   *
   * @param prompt - The prompt to pass into the model.
   *
   * @returns The full LLM output.
   *
   * @example
   * ```ts
   * import { OpenAIWhisper } from "langchain/llms";
   * const openai = new OpenAIWhisper();
   * const response = await openai.generate("file/path.mp3");
   * ```
   */
  async call(file: Blob, prompt?: string, language = "en"): Promise<string> {
    if (!file) {
      throw new Error("No file provided");
    }

    const params = this.invocationParams();

    const { data } = await this.transcriptionWithRetry({
      ...params,
      file,
      prompt,
      language,
    });
    return data.text;
  }

  async transcriptionWithRetry(request: OpenAIInput) {
    if (!this.batchClient) {
      const clientConfig = new Configuration({
        ...this.clientConfig,
        baseOptions: { adapter: fetchAdapter },
      });
      this.batchClient = new OpenAIApi(clientConfig);
    }

    const makeTranscriptionRequest = async () =>
      this.batchClient.createTranscription(
        // @ts-expect-error can't use File type on the backend, default to Blob
        request.file,
        this.model,
        request.prompt,
        this.responseFormat,
        this.temperature,
        request.language
      );

    return backOff(makeTranscriptionRequest, {
      startingDelay: 4,
      maxDelay: 10,
      numOfAttempts: this.maxRetries,
    });
  }

  _llmType() {
    return "openai";
  }
}
