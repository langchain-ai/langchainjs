import {
  GoogleAbstractedClient,
  GoogleBaseLLM,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import { GoogleAuthOptions } from "google-auth-library";
import { GAuthClient } from "./auth.js";

/**
 * Input to LLM class.
 */
export interface GoogleLLMInput extends GoogleBaseLLMInput<GoogleAuthOptions> {}

/**
 * Integration with a Google LLM.
 */
export class GoogleLLM
  extends GoogleBaseLLM<GoogleAuthOptions>
  implements GoogleLLMInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleLLM";
  }

  lc_serializable = true;

  constructor(fields?: GoogleLLMInput) {
    super(fields);
    this._addVersion("@langchain/google-gauth", __PKG_VERSION__);
  }

  buildAbstractedClient(
    fields: GoogleBaseLLMInput<GoogleAuthOptions> | undefined
  ): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }
}
