import { type GoogleLLMInput, GoogleLLM } from "@langchain/google-webauth";

/**
 * Input to a Google Vertex LLM class.
 */
export interface VertexAIInput extends GoogleLLMInput {}

/**
 * Integration with a Google Vertex AI LLM using
 * the "@langchain/google-webauth" package for auth.
 */
export class VertexAI extends GoogleLLM {
  lc_namespace = ["langchain", "llms", "vertexai"];

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
