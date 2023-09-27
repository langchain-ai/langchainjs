import { CallbackManagerForLLMRun } from "../../callbacks/manager.js";
import { BaseLLMParams, LLM } from "../base.js";

interface CitationSource {
  startIndex?: number | null;
  endIndex?: number | null;
  uri?: string | null;
  license?: string | null;
}

interface Message {
  author?: string | null;
  content: string;
  citationMetadata?: {
    citationSources?: Array<CitationSource>;
  };
}

type HarmCategory =
  | "HARM_CATEGORY_UNSPECIFIED"
  | "HARM_CATEGORY_DEROGATORY"
  | "HARM_CATEGORY_TOXICITY"
  | "HARM_CATEGORY_VIOLENCE"
  | "HARM_CATEGORY_SEXUAL"
  | "HARM_CATEGORY_MEDICAL"
  | "HARM_CATEGORY_DANGEROUS";

type HarmProbability =
  | "HARM_PROBABILITY_UNSPECIFIED"
  | "NEGLIGIBLE"
  | "LOW"
  | "MEDIUM"
  | "HIGH";

interface SafetyRating {
  category?: HarmCategory | null;
  probability?: HarmProbability | null;
}

interface Example {
  input: Message;
  output: Message;
}

interface ContentFilter {
  reason: "BLOCKED_REASON_UNSPECIFIED" | "SAFETY" | "OTHER";
  message: string;
}

interface TextPrompt {
  text: string;
}

interface GenerateTextRequest {
  prompt: TextPrompt;
  safetySettings?: Array<SafetyRating>;
  stopSequences?: string[];
  temperature?: number;
  candidateCount?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

type HarmBlockThreshold =
  | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
  | "BLOCK_LOW_AND_ABOVE"
  | "BLOCK_MEDIUM_AND_ABOVE"
  | "BLOCK_ONLY_HIGH";

interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

interface SafetyFeedback {
  rating: SafetyRating;
  setting: SafetySetting;
}

interface GenerateTextResponse {
  candidates: Array<{
    output: string;
    safetyRankings: Array<SafetyRating>;
  }>;
  safetyFeedback: Array<SafetyFeedback>;
  filters?: Array<ContentFilter>;
}

interface WebGooglePaLMTextInput extends BaseLLMParams {
  /**
   * Model Name to use
   *
   * Note: The format must follow the pattern - `models/{model}`
   */
  modelName?: string;
  /**
   * Controls the randomness of the output.
   *
   * Values can range from [0.0,1.0], inclusive. A value closer to 1.0
   * will produce responses that are more varied and creative, while
   * a value closer to 0.0 will typically result in less surprising
   * responses from the model.
   *
   * Note: The default value varies by model
   */
  temperature?: number;
  /**
   * Top-p changes how the model selects tokens for output.
   *
   * Tokens are selected from most probable to least until the sum
   * of their probabilities equals the top-p value.
   *
   * For example, if tokens A, B, and C have a probability of
   * .3, .2, and .1 and the top-p value is .5, then the model will
   * select either A or B as the next token (using temperature).
   *
   * Note: The default value varies by model
   */
  topP?: number;
  /**
   * Top-k changes how the model selects tokens for output.
   *
   * A top-k of 1 means the selected token is the most probable among
   * all tokens in the model’s vocabulary (also called greedy decoding),
   * while a top-k of 3 means that the next token is selected from
   * among the 3 most probable tokens (using temperature).
   *
   * Note: The default value varies by model
   */
  topK?: number;

  safetySettings?: Array<SafetyRating>;

  maxOutputTokens?: number;

  // examples?: protos.google.ai.generativelanguage.v1beta2.IExample[];
  /**
   * Google Palm API key to use
   */
  apiKey?: string;
}

export class GooglePalm extends LLM implements WebGooglePaLMTextInput {
  lc_serializable = true;

  static lc_name() {
    return "GooglePalm";
  }

  get lc_secrets(): { [key: string]: string } {
    return {
      apiKey: "GOOGLE_API_KEY",
    };
  }

  get lc_aliases(): Record<string, string> {
    return {
      apiKey: "google_api_key",
    };
  }

  modelName = "models/text-bison-001";

  temperature?: number;

  topP?: number;

  topK?: number;

  examples?: Array<Example>;

  safetySettings?: SafetyRating[];

  maxOutputTokens?: number;

  apiKey: string;

  constructor(fields?: WebGooglePaLMTextInput) {
    super({ ...fields });

    this.modelName = fields?.modelName ?? this.modelName;
    this.temperature = fields?.temperature;
    this.topP = fields?.topP;
    this.topK = fields?.topK;
    this.safetySettings = fields?.safetySettings;
    this.maxOutputTokens = fields?.maxOutputTokens;
    this.apiKey = fields?.apiKey ?? "";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _combineLLMOutput?(): Record<string, any> {
    return {};
  }

  _llmType(): string {
    return "google_palm";
  }

  async _call(
    prompt: string,
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const url = new URL(
      `/v1beta2/${this.modelName}:generateText`,
      "https://generativelanguage.googleapis.com"
    );

    const payload: GenerateTextRequest = {
      candidateCount: 1,
      prompt: { text: prompt },
      maxOutputTokens: this.maxOutputTokens,
      safetySettings: this.safetySettings,
      stopSequences: options.stop,
      temperature: this.temperature,
      topK: this.topK,
      topP: this.topP,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!response.ok) {
      let error = new Error(`Failed to call PaLM API: ${response.status}`);
      try {
        const payload = await response.json();
        error = new Error(
          `${payload.error?.status}: ${payload.error?.message}`
        );
      } catch {
        // ignore
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).response = response;
      throw error;
    }

    const json: GenerateTextResponse = await response.json();
    const result =
      (json.candidates && json.candidates.length > 0
        ? json.candidates[0].output
        : undefined) ?? "";

    void runManager?.handleLLMNewToken(result);
    return result;
  }
}
