import { GoogleAuthOptions } from "google-auth-library";
import { BaseChatGoogleVertexAI, GoogleVertexAIChatInput } from "./common.js";
import { GoogleVertexAILLMConnection } from "../../utils/googlevertexai-connection.js";
import { GAuthClient } from "../../utils/googlevertexai-gauth.js";

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models in a chat-like fashion.
 *
 * To use, you will need to have one of the following authentication
 * methods in place:
 * - You are logged into an account permitted to the Google Cloud project
 *   using Vertex AI.
 * - You are running this on a machine using a service account permitted to
 *   the Google Cloud project using Vertex AI.
 * - The `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set to the
 *   path of a credentials file for a service account permitted to the
 *   Google Cloud project using Vertex AI.
 * @example
 * ```typescript
 * const model = new ChatGoogleVertexAI({
 *   temperature: 0.7,
 * });
 * const result = await model.invoke("What is the capital of France?");
 * ```
 */
export class ChatGoogleVertexAI extends BaseChatGoogleVertexAI<GoogleAuthOptions> {
  static lc_name() {
    return "ChatVertexAI";
  }

  constructor(fields?: GoogleVertexAIChatInput<GoogleAuthOptions>) {
    super(fields);

    const client = new GAuthClient({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
      ...fields?.authOptions,
    });

    this.connection = new GoogleVertexAILLMConnection(
      { ...fields, ...this },
      this.caller,
      client,
      false
    );

    this.streamedConnection = new GoogleVertexAILLMConnection(
      { ...fields, ...this },
      this.caller,
      client,
      true
    );
  }
}

export type {
  ChatExample,
  GoogleVertexAIChatAuthor,
  GoogleVertexAIChatInput,
  GoogleVertexAIChatInstance,
  GoogleVertexAIChatMessage,
  GoogleVertexAIChatMessageFields,
  GoogleVertexAIChatPrediction,
} from "./common.js";
