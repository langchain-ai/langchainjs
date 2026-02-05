import {
  ChatGoogleBase,
  ChatGoogleBaseInput,
  GoogleAbstractedClient,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import { GoogleAuthOptions } from "google-auth-library";
import { GAuthClient } from "./auth.js";

/**
 * Input to chat model class.
 */
export interface ChatGoogleInput
  extends ChatGoogleBaseInput<GoogleAuthOptions> {}

/**
 * Integration with a Google chat model.
 */
export class ChatGoogle
  extends ChatGoogleBase<GoogleAuthOptions>
  implements ChatGoogleInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatGoogle";
  }

  constructor(fields?: ChatGoogleInput) {
    super(fields);
  }

  buildAbstractedClient(
    fields: GoogleBaseLLMInput<GoogleAuthOptions> | undefined
  ): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }
}
