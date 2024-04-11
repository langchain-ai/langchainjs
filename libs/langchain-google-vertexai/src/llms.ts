import { type GoogleLLMInput, GoogleLLM } from "@langchain/google-gauth";

/**
 * Input to LLM model class.
 */
export interface VertexAIInput extends GoogleLLMInput {}

/**
 * Integration with a LLM model.
 */
export class VertexAI extends GoogleLLM {
  static lc_name() {
    return "VertexAI";
  }

  constructor(fields?: VertexAIInput) {
    super({
      ...fields,
      platformType: "gcp",
    });
  }
}
