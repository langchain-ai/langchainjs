import {
  GoogleAbstractedClient,
  GoogleConnectionParams,
  BaseGoogleEmbeddings,
  BaseGoogleEmbeddingsParams,
} from "@langchain/google-common";
import { GoogleAuthOptions } from "google-auth-library";
import { GAuthClient } from "./auth.js";

/**
 * Input to LLM class.
 */
export interface GoogleEmbeddingsInput
  extends BaseGoogleEmbeddingsParams<GoogleAuthOptions> {}

/**
 * Integration with an Google embeddings model.
 */
export class GoogleEmbeddings
  extends BaseGoogleEmbeddings<GoogleAuthOptions>
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
    fields?: GoogleConnectionParams<GoogleAuthOptions>
  ): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }
}
