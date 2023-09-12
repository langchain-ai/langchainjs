import { GoogleAuth, GoogleAuthOptions } from "google-auth-library";
import { GoogleVertexAILLMConnection } from "../../util/googlevertexai-connection.js";
import { GoogleVertexAIBaseLLMInput } from "../../types/googlevertexai-types.js";
import { BaseGoogleVertexAI } from "./common.js";

/**
 * Interface representing the input to the Google Vertex AI model.
 */
export interface GoogleVertexAITextInput
  extends GoogleVertexAIBaseLLMInput<GoogleAuthOptions> {}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models.
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
 */
export class GoogleVertexAI extends BaseGoogleVertexAI<GoogleAuthOptions> {
  static lc_name() {
    return "VertexAI";
  }

  constructor(fields?: GoogleVertexAITextInput) {
    super(fields);

    const client = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
      ...fields?.authOptions,
    });

    this.connection = new GoogleVertexAILLMConnection(
      { ...fields, ...this },
      this.caller,
      client
    );
  }
}
