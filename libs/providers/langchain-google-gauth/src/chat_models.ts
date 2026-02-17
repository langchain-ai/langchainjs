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
export interface ChatGoogleInput extends ChatGoogleBaseInput<GoogleAuthOptions> {}

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

  constructor(model: string, params?: Omit<ChatGoogleInput, "model">);
  constructor(fields?: ChatGoogleInput);
  constructor(
    modelOrFields?: string | ChatGoogleInput,
    paramsArg?: Omit<ChatGoogleInput, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(paramsArg ?? {}), model: modelOrFields }
        : modelOrFields ?? {};
    super(fields);
  }

  buildAbstractedClient(
    fields: GoogleBaseLLMInput<GoogleAuthOptions> | undefined
  ): GoogleAbstractedClient {
    return new GAuthClient(fields);
  }
}
