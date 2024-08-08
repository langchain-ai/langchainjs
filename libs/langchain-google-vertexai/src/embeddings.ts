import {
  type GoogleEmbeddingsInput,
  GoogleEmbeddings,
} from "@langchain/google-gauth";

/**
 * Input to chat model class.
 */
export interface GoogleVertexAIEmbeddingsInput extends GoogleEmbeddingsInput {}

/**
 * Integration with a chat model.
 */
export class GoogleVertexAIEmbeddings extends GoogleEmbeddings {
  static lc_name() {
    return "GoogleVertexAIEmbeddings";
  }

  constructor(fields: GoogleVertexAIEmbeddingsInput) {
    super({
      ...fields,
      platformType: "gcp",
    });
  }
}
