export const DEFAULT_RESPONSE_FORMAT = "text" as const;
export const DEFAULT_MODEL = "whisper-1" as const;
export const GPT_RESPONSE_FORMATS = ["text", "json"] as const;
export const WHISPER_RESPONSE_FORMATS = [...GPT_RESPONSE_FORMATS, "srt", "verbose_json", "vtt"] as const;
export const DEFAULT_TIMESTAMP_GRANULARITIES = ["word", "segment"] as const;
