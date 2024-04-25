import { type ChatGoogleInput, ChatGoogle } from "@langchain/google-gauth";

/**
 * Input to chat model class.
 */
export interface ChatVertexAIInput extends ChatGoogleInput {}

/**
 * Integration with a chat model.
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
