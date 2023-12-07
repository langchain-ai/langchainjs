import {
  WebGoogleAuth,
  WebGoogleAuthOptions,
} from "../../utils/googlevertexai-webauth.js";
import { GoogleVertexAILLMConnection } from "../../utils/googlevertexai-connection.js";
import { GoogleVertexAIBaseLLMInput } from "../../types/googlevertexai-types.js";
import { BaseGoogleVertexAI } from "./common.js";

/**
 * Interface representing the input to the Google Vertex AI model.
 */
export interface GoogleVertexAITextInput
  extends GoogleVertexAIBaseLLMInput<WebGoogleAuthOptions> {}

/**
 * Enables calls to the Google Cloud's Vertex AI API to access
 * Large Language Models.
 *
 * This entrypoint and class are intended to be used in web environments like Edge
 * functions where you do not have access to the file system. It supports passing
 * service account credentials directly as a "GOOGLE_VERTEX_AI_WEB_CREDENTIALS"
 * environment variable or directly as "authOptions.credentials".
 * @example
 * ```typescript
 * const model = new GoogleVertexAI({
 *   temperature: 0.7,
 * });
 * const stream = await model.stream(
 *   "What would be a good company name for a company that makes colorful socks?",
 * );
 * for await (const chunk of stream) {
 *   console.log(chunk);
 * }
 * ```
 */
export class GoogleVertexAI extends BaseGoogleVertexAI<WebGoogleAuthOptions> {
  static lc_name() {
    return "VertexAI";
  }

  get lc_secrets(): { [key: string]: string } {
    return {
      "authOptions.credentials": "GOOGLE_VERTEX_AI_WEB_CREDENTIALS",
    };
  }

  constructor(fields?: GoogleVertexAITextInput) {
    super(fields);

    const client = new WebGoogleAuth(fields?.authOptions);

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
