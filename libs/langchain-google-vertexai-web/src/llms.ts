import { type GoogleLLMInput, GoogleLLM } from "@langchain/google-webauth";

/**
 * Input to LLM model class.
 */
export interface VertexAILLMInput extends GoogleLLMInput {}

/**
 * Integration with a LLM model.
 */
export class VertexAILLM extends GoogleLLM {
  static lc_name() {
    return "ChatVertexAI";
  }

  constructor(fields?: VertexAILLMInput) {
    super(fields);
  }
}
