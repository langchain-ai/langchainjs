import { type GoogleLLMInput, GoogleLLM } from "@langchain/google-webauth";

/**
 * Input to chat model class.
 */
export interface VertexAILLMInput extends GoogleLLMInput {}

/**
 * Integration with a chat model.
 */
export class VertexAILLM extends GoogleLLM {
  static lc_name() {
    return "ChatVertexAI";
  }

  constructor(fields?: VertexAILLMInput) {
    super(fields);
  }
}
