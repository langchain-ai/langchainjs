import {
  type GoogleEmbeddingsInput,
  GoogleEmbeddings,
} from "@langchain/google-gauth";

/**
 * Input to a Google Vertex AI embeddings class.
 */
export interface GoogleVertexAIEmbeddingsInput extends GoogleEmbeddingsInput {}

/**
 * Integration with a Google Vertex AI embeddings model using
 * the "@langchain/google-gauth" package for auth.
 */
export class VertexAIEmbeddings extends GoogleEmbeddings {
  static lc_name() {
    return "VertexAIEmbeddings";
  }

  constructor(fields: GoogleVertexAIEmbeddingsInput) {
    super({
      ...fields,
      platformType: "gcp",
    });
  }
}
