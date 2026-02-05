import { type GoogleLLMInput, GoogleLLM } from "@langchain/google-gauth";

/**
 * Input to a Google Vertex AI LLM class.
 */
export interface VertexAIInput extends GoogleLLMInput {}

/**
 * Integration with a Google Vertex AI LLM using
 * the "@langchain/google-gauth" package for auth.
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
