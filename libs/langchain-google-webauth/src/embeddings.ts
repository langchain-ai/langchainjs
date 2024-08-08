import {
  GoogleAbstractedClient,
  GoogleConnectionParams,
  BaseGoogleEmbeddings,
  BaseGoogleEmbeddingsParams,
} from "@langchain/google-common";
import { WebGoogleAuth, WebGoogleAuthOptions } from "./auth.js";

/**
 * Input to LLM class.
 */
export interface GoogleEmbeddingsInput
  extends BaseGoogleEmbeddingsParams<WebGoogleAuthOptions> {}

/**
 * Integration with an LLM.
 */
export class GoogleEmbeddings
  extends BaseGoogleEmbeddings<WebGoogleAuthOptions>
  implements GoogleEmbeddingsInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleEmbeddings";
  }

  lc_serializable = true;

  constructor(fields: GoogleEmbeddingsInput) {
    super(fields);
  }

  buildAbstractedClient(
    fields?: GoogleConnectionParams<WebGoogleAuthOptions>
  ): GoogleAbstractedClient {
    return new WebGoogleAuth(fields);
  }
}
