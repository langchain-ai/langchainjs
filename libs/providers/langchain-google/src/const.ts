export const GOOGLE_API_KEY_HEADER = "x-goog-api-key";

export const GCP_API_KEY_HEADER = "Authorization";

export const GENERATIVE_AI_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/generative-language",
];

export const VERTEX_AI_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
];

/** response_metadata key for a tool-call-id -> thoughtSignature map. */
export const GOOGLE_TOOL_CALL_THOUGHT_SIGNATURES_KEY =
  "google_tool_call_thought_signatures";
