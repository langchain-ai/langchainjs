export type AssemblyAIOptions = {
  /**
   * The AssemblyAI API key. Alternatively, you can configure this as the `ASSEMBLYAI_API_KEY` environment variable.
   */
  apiKey: string;
};

/**
 * The parameters to create a Transcript in the AssemblyAI API.
 */
export type CreateTranscriptParams = {
  /**
   * The URL of your media file to transcribe.
   */
  audio_url: string;

  /**
   * The language of your audio file. Possible values are found in [Supported Languages]{@link https://www.assemblyai.com/docs/Concepts/supported_languages}.
   * The default value is en_us.
   */
  language_code?: string;

  /**
   * Enable Automatic Punctuation, can be true or false
   */
  punctuate?: boolean;

  /**
   * Enable Text Formatting, can be true or false
   */
  format_text?: boolean;

  /**
   * Enable Dual Channel transcription, can be true or false
   */
  dual_channel?: boolean;

  /**
   * The URL we should send webhooks to when your transcript is complete
   */
  webhook_url?: string;

  /**
   * Defaults to null. Optionally allows a user to specify a header name and value to send back with a webhook call for added security.
   */
  webhook_auth_header_name?: string;

  /**
   * Defaults to null. Optionally allows a user to specify a header name and value to send back with a webhook call for added security.
   */
  webhook_auth_header_value?: string;

  /**
   * The point in time, in milliseconds, to begin transcription from in your media file
   */
  audio_start_from?: number;

  /**
   * The point in time, in milliseconds, to stop transcribing in your media file
   */
  audio_end_at?: number;

  /**
   * A list of custom vocabulary to boost transcription probability for. See [Custom vocabulary]{@link https://www.assemblyai.com/docs/Models/speech_recognition#custom-vocabulary} for more details.
   */
  word_boost?: string[];

  /**
   * The weight to apply to words/phrases in the word_boost array; can be "low", "default", or "high"
   */
  boost_param?: "low" | "default" | "high";

  /**
   * Filter profanity from the transcribed text, can be true or false
   */
  filter_profanity?: boolean;

  /**
   * Redact PII from the transcribed text using the Redact PII model, can be true or false
   */
  redact_pii?: boolean;

  /**
   * Generate a copy of the original media file with spoken PII "beeped" out, can be true or false. See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more details.
   */
  redact_pii_audio?: boolean;

  /**
   * Controls the filetype of the audio created by redact_pii_audio. Currently supports mp3 (default) and wav. See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more details.
   */
  redact_pii_audio_quality?: string;

  /**
   * The list of PII Redaction policies to enable. See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more details.
   */
  redact_pii_policies?: (typeof PiiPolicy)[keyof typeof PiiPolicy];

  /**
   * The replacement logic for detected PII, can be "entity_type" or "hash". See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more details.
   */
  redact_pii_sub?: "entity_type" | "hash";

  /**
   * Enable [Speaker diarization]{@link https://www.assemblyai.com/docs/Models/speaker_diarization}, can be true or false
   */
  speaker_labels?: boolean;

  /**
   * Defaults to null. Tells the speaker label model how many speakers it should attempt to identify, up to 10. See [Speaker diarization]{@link https://www.assemblyai.com/docs/Models/speaker_diarization} for more details.
   */
  speakers_expected?: number;

  /**
   * Enable [Content Moderation]{@link https://www.assemblyai.com/docs/Models/content_moderation}, can be true or false
   */
  content_safety?: boolean;

  /**
   * Enable [Topic Detection]{@link https://www.assemblyai.com/docs/Models/iab_classification}, can be true or false
   */
  iab_categories?: boolean;

  /**
   * Customize how words are spelled and formatted using to and from values
   */
  custom_spelling?: CustomSpelling[];

  /**
   * Transcribe Filler Words, like "umm", in your media file; can be true or false
   */
  disfluencies?: boolean;

  /**
   * Enable [Sentiment Analysis]{@link https://www.assemblyai.com/docs/Models/sentiment_analysis}, can be true or false
   */
  sentiment_analysis?: boolean;

  /**
   * Enable [Auto Chapters]{@link https://www.assemblyai.com/docs/Models/auto_chapters}, can be true or false
   */
  auto_chapters?: boolean;

  /**
   * Enable [Entity Detection]{@link https://www.assemblyai.com/docs/Models/entity_detection}, can be true or false
   */
  entity_detection?: boolean;

  /**
   * Defaults to null. Reject audio files that contain less than this fraction of speech.
   * Valid values are in the range [0, 1] inclusive.
   */
  speech_threshold?: number;
} & Record<string, unknown>;

/**
 * The list of PII Redaction policies to enable.
 * See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more details.
 */
export const PiiPolicy = {
  /**
   * Medical process, including treatments, procedures, and tests (e.g., heart surgery, CT scan)
   */
  MedicalProcess: "medical_process",

  /**
   * Name of a medical condition, disease, syndrome, deficit, or disorder (e.g., chronic fatigue syndrome, arrhythmia, depression)
   */
  MedicalCondition: "medical_condition",

  /**
   * Blood type (e.g., O-, AB positive)
   */
  BloodType: "blood_type",

  /**
   * Medications, vitamins, or supplements (e.g., Advil, Acetaminophen, Panadol)
   */
  Drug: "drug",

  /**
   * Bodily injury (e.g., I broke my arm, I have a sprained wrist)
   */
  Injury: "injury",

  /**
   * A "lazy" rule that will redact any sequence of numbers equal to or greater than 2
   */
  NumberSequence: "number_sequence",

  /**
   * Email address (e.g., support@assemblyai.com)
   */
  EmailAddress: "email_address",

  /**
   * Date of Birth (e.g., Date of Birth: March 7,1961)
   */
  DateOfBirth: "date_of_birth",

  /**
   * Telephone or fax number
   */
  PhoneNumber: "phone_number",

  /**
   * Social Security Number or equivalent
   */
  UsSocialSecurityNumber: "us_social_security_number",

  /**
   * Credit card number
   */
  CreditCardNumber: "credit_card_number",

  /**
   * Expiration date of a credit card
   */
  CreditCardExpiration: "credit_card_expiration",

  /**
   * Credit card verification code (e.g., CVV: 080)
   */
  CreditCardCvv: "credit_card_cvv",

  /**
   * Specific calendar date (e.g., December 18)
   */
  Date: "date",

  /**
   * Terms indicating nationality, ethnicity, or race (e.g., American, Asian, Caucasian)
   */
  Nationality: "nationality",

  /**
   * Name of an event or holiday (e.g., Olympics, Yom Kippur)
   */
  Event: "event",

  /**
   * Name of a natural language (e.g., Spanish, French)
   */
  Language: "language",

  /**
   * Any Location reference including mailing address, postal code, city, state, province, or country
   */
  Location: "location",

  /**
   * Name and/or amount of currency (e.g., 15 pesos, $94.50)
   */
  MoneyAmount: "money_amount",

  /**
   * Name of a person (e.g., Bob, Doug Jones)
   */
  PersonName: "person_name",

  /**
   * Number associated with an age (e.g., 27, 75)
   */
  PersonAge: "person_age",

  /**
   * Name of an organization (e.g., CNN, McDonalds, University of Alaska)
   */
  Organization: "organization",

  /**
   * Terms referring to a political party, movement, or ideology (e.g., Republican, Liberal)
   */
  PoliticalAffiliation: "political_affiliation",

  /**
   * Job title or profession (e.g., professor, actors, engineer, CPA)
   */
  Occupation: "occupation",

  /**
   * Terms indicating religious affiliation (e.g., Hindu, Catholic)
   */
  Religion: "religion",

  /**
   * Driver’s license number (e.g., DL# 356933-540)
   */
  DriversLicense: "drivers_license",

  /**
   * Banking information, including account and routing numbers
   */
  BankingInformation: "banking_information",
} as const;

/**
 * CustomSpelling specifies a mapping from a word or phrase to a new spelling or format.
 * CustomSpelling should include a `from` key, which specifies the word or phrase to be replaced,
 * and a `to` key, which specifies the new spelling or format.
 * Note that the value in the `to` key is case sensitive, but the value in the `from` key is not.
 * Additionally, the `to` key should only contain one word, while the `from` key can contain multiple words.
 */
export type CustomSpelling = { from: string[]; to: string };

/**
 * The transcript object returned by the AssemblyAI API.
 */
export type Transcript = {
  /**
   * The unique identifier of your transcription
   */
  id: string;

  /**
   * The language model that was used for the transcription
   */
  language_model: string;

  /**
   * The acoustic model that was used for the transcription
   */
  acoustic_model: string;

  /**
   * The status of your transcription. Possible values are queued, processing, completed, or error
   */
  status: string;

  /**
   * The language of your audio file.
   * Possible values are found in [Supported Languages]{@link https://www.assemblyai.com/docs/Concepts/supported_languages}.
   * The default value is en_us.
   */

  language_code: string;

  /**
   * The URL of the media that was transcribed
   */
  audio_url: string;

  /**
   * The textual transcript of your media file
   */
  text: string;

  /**
   * An array of temporally-sequential word objects, one for each word in the transcript.
   * See [Speech recognition]{@link https://www.assemblyai.com/docs/Models/speech_recognition} for more information.
   */
  words: Word[] | null;

  /**
   * When dual_channel or speaker_labels is enabled, a list of turn-by-turn utterance objects.
   * See [Speaker diarization]{@link https://www.assemblyai.com/docs/Models/speaker_diarization} for more information.
   */
  utterances: TranscriptSegment[] | null;

  /**
   * The confidence score for the transcript, between 0.0 (low confidence) and 1.0 (high confidence)
   */
  confidence: number;

  /**
   * The duration of this transcript object's media file, in seconds
   */
  audio_duration: number;

  /**
   * Whether Automatic Punctuation was enabled in the transcription request, either true or false
   */
  punctuate: boolean;

  /**
   * Whether Text Formatting was enabled in the transcription request, either true or false
   */
  format_text: boolean;

  /**
   * Whether [Dual channel transcription]{@link https://www.assemblyai.com/docs/Models/speech_recognition#dual-channel-transcription} was enabled in the transcription request, either true or false
   */
  dual_channel: boolean | null;

  /**
   * The URL to which we send webhooks upon trancription completion, if provided in the transcription request
   */
  webhook_url: string | null;

  /**
   * The status code we received from your server when delivering your webhook, if a webhook URL was provided in the transcription request
   */
  webhook_status_code: string | null;

  /**
   * Whether webhook authentication details were provided in the transcription request
   */
  webhook_auth: boolean;

  /**
   * The header name which should be sent back with webhook calls, if provided in the transcription request
   */
  webhook_auth_header_name: string | null;

  /**
   * Whether speed boost was enabled in the transcription request
   * */
  speed_boost: boolean;

  /**
   * An array of results for the Key Phrases model, if it was enabled during the transcription request.
   * See [Key phrases]{@link https://www.assemblyai.com/docs/Models/key_phrases} for more information.
   */
  auto_highlights_result?: {
    /**
     * Will be either success, or unavailable in the rare case that the Key Phrases model failed
     */
    status: "success" | "unavailable";

    /**
     * A temporally-sequential array of Key Phrases
     */
    results: Array<{
      /**
       * The total number of times the i-th key phrase appears in the audio file
       */
      count: number;

      /**
       * The total relevancy to the overall audio file of this key phrase - a greater number means more relevant
       */
      rank: number;

      /**
       * The text itself of the key phrase
       */
      text: string;

      /**
       * The timestamp of the j-th appearance of the i-th key phrase
       */
      timestamps: Timestamp[];
    }>;
  } | null;

  /**
   * Whether Key Phrases was enabled in the transcription request, either true or false
   */
  auto_highlights: boolean;

  /**
   * The point in time, in milliseconds, in the file at which the transcription was started,
   * if provided in the transcription request
   */
  audio_start_from: number | null;

  /**
   * The point in time, in milliseconds, in the file at which the transcription was terminated,
   * if provided in the transcription request
   */
  audio_end_at: number | null;

  /**
   * The list of custom vocabulary to boost transcription probability for, if provided in the transcription request
   */
  word_boost: string[] | null;

  /**
   * The word boost parameter value, if provided in the transcription request
   */
  boost_param: string | null;

  /**
   * Whether [Profanity Filtering]{@link https://www.assemblyai.com/docs/Models/speech_recognition#profanity-filtering} was enabled in the transcription request, either true or false
   */
  filter_profanity: boolean;

  /**
   * Whether [PII Redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} was enabled in the transcription request, either true or false
   */
  redact_pii: boolean;

  /**
   * Whether a redacted version of the audio file was generated (enabled or disabled in the transcription request),
   * either true or false. See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more information.
   */
  redact_pii_audio: boolean;

  /**
   * The audio quality of the PII-redacted audio file, if enabled in the transcription request.
   * See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more information.
   */
  redact_pii_audio_quality: string | null;

  /**
   * The list of PII Redaction policies that were enabled, if PII Redaction is enabled.
   * See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more information.
   */
  redact_pii_policies: Array<(typeof PiiPolicy)[keyof typeof PiiPolicy]> | null;

  /**
   * Which replacement type was used to redact PII.
   * See [PII redaction]{@link https://www.assemblyai.com/docs/Models/pii_redaction} for more information.
   */
  redact_pii_sub: string | null;

  /**
   * Whether [Speaker diarization]{@link https://www.assemblyai.com/docs/Models/speaker_diarization} was enabled in the transcription request, either true or false
   */
  speaker_labels: boolean;

  /**
   * The value for the speaker_expected parameter in the transcription request, if provided.
   * See [Speaker diarization]{@link https://www.assemblyai.com/docs/Models/speaker_diarization} for more information.
   */
  speakers_expected: number | null;

  /**
   * Whether [Content Moderation]{@link https://www.assemblyai.com/docs/Models/content_moderation} was enabled in the transcription request, either true or false
   */
  content_safety: boolean;

  /**
   * Whether [Topic Detection]{@link https://www.assemblyai.com/docs/Models/iab_classification} was enabled in the transcription request, either true or false
   */
  iab_categories: boolean;

  /**
   * An array of results for the Content Moderation model, if it was enabled during the transcription request.
   * See [Content moderation]{@link https://www.assemblyai.com/docs/Models/content_moderation} for more information.
   */
  content_safety_labels?: unknown[]; // Replace 'unknown' with the actual type for content moderation results

  /**
   * An array of results for the Topic Detection model, if it was enabled during the transcription request.
   * See [Topic Detection]{@link https://www.assemblyai.com/docs/Models/iab_classification} for more information.
   */
  iab_categories_result: {
    /**
     * Will be either success, or unavailable in the rare case that the Content Moderation model failed
     */
    status: "success" | "unavailable";
    results: Array<{
      /**
       * The text in the transcript in which the i-th instance of a detected topic occurs
       */
      text: string;
      labels: Array<{
        /**
         * How relevant the j-th detected topic is in the i-th instance of a detected topic
         */
        relevance: number;

        /**
         * The IAB taxonomical label for the j-th label of the i-th instance of a detected topic, where > denotes supertopic/subtopic relationship
         */
        label: string;
      }>;
      timestamp: Timestamp;
    }>;
    /**
     * The overall relevance of topic to the entire audio file
     */
    summary: { [key: string]: number };
  } | null;

  /**
   * Whether [Automatic language detection]{@link https://www.assemblyai.com/docs/Models/speech_recognition#automatic-language-detection} was enabled in the transcription request, either true or false
   */
  language_detection: boolean;

  /**
   * The custom spelling value passed in to the transcription request, if provided
   */
  custom_spelling: CustomSpelling[] | null;

  /**
   * Whether [Auto Chapters]{@link https://www.assemblyai.com/docs/Models/auto_chapters} was enabled in the transcription request, either true or false
   */
  auto_chapters: boolean;

  /**
   * Whether [Summarization]{@link https://www.assemblyai.com/docs/Models/summarization} was enabled in the transcription request, either true or false
   */
  summarization: boolean;

  /**
   * The type of summary generated, if [Summarization]{@link https://www.assemblyai.com/docs/Models/summarization} was enabled in the transcription request
   */
  summary_type: string | null;

  /**
   * The Summarization model used to generate the summary,
   * if [Summarization]{@link https://www.assemblyai.com/docs/Models/summarization} was enabled in the transcription request
   */
  summary_model: string | null;

  /**
   * Whether custom topics was enabled in the transcription request, either true or false
   */
  custom_topics: boolean;

  /**
   * The list of custom topics provided if custom topics was enabled in the transcription request
   */
  topics: string[] | null;

  /**
   * The value submitted for speech_threshold in the transcription request, if used. Otherwise, null.
   */
  speech_threshold: number | null;

  /**
   * Whether the transcription of disfluences was enabled in the transcription request, either true or false
   */
  disfluencies: boolean;

  /**
   * Whether [Sentiment Analysis]{@link https://www.assemblyai.com/docs/Models/sentiment_analysis} was enabled in the transcription request, either true or false
   */
  sentiment_analysis: boolean;

  /**
   * An array of results for the Sentiment Analysis model, if it was enabled during the transcription request.
   * See [Sentiment analysis]{@link https://www.assemblyai.com/docs/Models/sentiment_analysis} for more information.
   */
  sentiment_analysis_results: Array<{
    /**
     * The transcript of the sentence
     */
    text: string;

    /**
     * The starting time, in milliseconds, of the sentence
     */
    start: number;

    /**
     * The ending time, in milliseconds, of the sentence
     */
    end: number;

    /**
     * The detected sentiment for the sentence, one of POSITIVE, NEUTRAL, NEGATIVE
     */
    sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";

    /**
     * The confidence score for the detected sentiment of the sentence, from 0 to 1
     */
    confidence: number;

    /**
     * The speaker of the sentence if Speaker Diarization is enabled, else null
     */
    speaker: string | null;
  }> | null;

  /**
   * Whether [Entity detection]{@link https://www.assemblyai.com/docs/Models/entity_detection} was enabled in the transcription request, either true or false
   */
  entity_detection: boolean;

  /**
   * An array of results for the Entity Detection model, if it was enabled during the transcription request.
   * See [Entity detection]{@link https://www.assemblyai.com/docs/Models/entity_detection} for more information.
   */
  entities?: Array<{
    /**
     * The type of entity for the detected entity
     */
    entity_type: (typeof EntityType)[keyof typeof EntityType];

    /**
     * The text for the detected entity
     */
    text: string;

    /**
     * The starting time, in milliseconds, at which the detected entity appears in the audio file
     */
    start: number;

    /**
     * The ending time, in milliseconds, for the detected entity in the audio file
     */
    end: number;
  }> | null;

  /**
   * The generated summary of the media file, if [Summarization]{@link https://www.assemblyai.com/docs/Models/summarization} was enabled in the transcription request
   */
  summary: string | null;

  /**
   * True while a request is throttled and false when a request is no longer throttled
   */
  throttled: boolean | null;
};

export const EntityType = {
  BloodType: "Blood type (e.g., O-, AB positive)",
  CreditCardCvv: "Credit card verification code (e.g., CVV: 080)",
  CreditCardExpiration: "Expiration date of a credit card",
  CreditCardNumber: "Credit card number",
  Date: "Specific calendar date (e.g., December 18)",
  DateOfBirth: "Date of Birth (e.g., Date of Birth: March 7, 1961)",
  Drug: "Medications, vitamins, or supplements (e.g., Advil, Acetaminophen, Panadol)",
  Event: "Name of an event or holiday (e.g., Olympics, Yom Kippur)",
  EmailAddress: "Email address (e.g., support@assemblyai.com)",
  Injury: "Bodily injury (e.g., I broke my arm, I have a sprained wrist)",
  Language: "Name of a natural language (e.g., Spanish, French)",
  Location:
    "Any location reference including mailing address, postal code, city, state, province, or country",
  MedicalCondition:
    "Name of a medical condition, disease, syndrome, deficit, or disorder (e.g., chronic fatigue syndrome, arrhythmia, depression)",
  MedicalProcess:
    "Medical process, including treatments, procedures, and tests (e.g., heart surgery, CT scan)",
  MoneyAmount: "Name and/or amount of currency (e.g., 15 pesos, $94.50)",
  Nationality:
    "Terms indicating nationality, ethnicity, or race (e.g., American, Asian, Caucasian)",
  Occupation:
    "Job title or profession (e.g., professor, actors, engineer, CPA)",
  Organization:
    "Name of an organization (e.g., CNN, McDonalds, University of Alaska)",
  PersonAge: "Number associated with an age (e.g., 27, 75)",
  PersonName: "Name of a person (e.g., Bob, Doug Jones)",
  PhoneNumber: "Telephone or fax number",
  PoliticalAffiliation:
    "Terms referring to a political party, movement, or ideology (e.g., Republican, Liberal)",
  Religion: "Terms indicating religious affiliation (e.g., Hindu, Catholic)",
  UsSocialSecurityNumber: "Social Security Number or equivalent",
  DriversLicense: "Driver's license number (e.g., DL #356933-540)",
  BankingInformation:
    "Banking information, including account and routing numbers",
} as const;

/**
 * A segment of a transcript.
 */
export type TranscriptSegment = {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
  words: Word[];
};

/**
 * The paragraphs response for a transcript returned by the AssemblyAI API.
 */
export type ParagraphsResponse = {
  id: string;
  confidence: number;
  audio_duration: number;
  paragraphs: TranscriptSegment[];
};

/**
 * The sentences response for a transcript returned by the AssemblyAI API.
 */
export type SentencesResponse = {
  id: string;
  confidence: number;
  audio_duration: number;
  sentences: TranscriptSegment[];
};

/**
 * A word in a paragraph or sentence for a transcript returned by the AssemblyAI API.
 */
export type Word = {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: string;
};

export type Timestamp = {
  /**
   * The start of the timestamp in milliseconds.
   */
  start: number;

  /**
   * The end of the timestamp in milliseconds.
   */
  end: number;
};

/**
 * The error object returned by the AssemblyAI API.
 */
export type ErrorBody = {
  error: string;
};

/**
 * The format of the subtitles.
 */
export const SubtitleFormat = {
  Srt: "srt",
  Vtt: "vtt",
} as const;
