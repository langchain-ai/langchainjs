import {
  GoogleAbstractedClient,
  GoogleBaseLLM,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import { WebGoogleAuth, WebGoogleAuthOptions } from "./auth.js";

/**
 * Input to LLM class.
 */
export interface GoogleLLMInput
  extends GoogleBaseLLMInput<WebGoogleAuthOptions> {}

/**
 * Integration with an LLM.
 */
export class GoogleLLM
  extends GoogleBaseLLM<WebGoogleAuthOptions>
  implements GoogleLLMInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleLLM";
  }

  lc_serializable = true;

  constructor(fields?: GoogleLLMInput) {
    super(fields);
  }

  buildAbstractedClient(
    fields: GoogleBaseLLMInput<WebGoogleAuthOptions> | undefined
  ): GoogleAbstractedClient {
    return new WebGoogleAuth(fields);
  }
}
