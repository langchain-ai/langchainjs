import { type ChatGoogleInput, ChatGoogle } from "@langchain/google-gauth";

/**
 * Input to a Google Vertex AI chat model class.
 */
export interface ChatVertexAIInput extends ChatGoogleInput {}

/**
 * Integration with a Google Vertex AI chat model using
 * the "@langchain/google-gauth" package for auth.
 */
export class ChatVertexAI extends ChatGoogle {
  static lc_name() {
    return "ChatVertexAI";
  }

  constructor(fields?: ChatVertexAIInput) {
    super({
      ...fields,
      platformType: "gcp",
    });
  }
}
