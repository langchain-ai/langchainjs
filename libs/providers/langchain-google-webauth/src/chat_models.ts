import {
  ChatGoogleBase,
  ChatGoogleBaseInput,
  GoogleAbstractedClient,
  GoogleBaseLLMInput,
} from "@langchain/google-common";
import { WebGoogleAuth, WebGoogleAuthOptions } from "./auth.js";

/**
 * Input to chat model class.
 */
export interface ChatGoogleInput extends ChatGoogleBaseInput<WebGoogleAuthOptions> {}

/**
 * Integration with a chat model.
 */
export class ChatGoogle
  extends ChatGoogleBase<WebGoogleAuthOptions>
  implements ChatGoogleInput
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatGoogle";
  }

  constructor(model: string, fields?: Omit<ChatGoogleInput, "model">);
  constructor(fields?: ChatGoogleInput);
  constructor(
    modelOrFields?: string | ChatGoogleInput,
    fieldsArg?: Omit<ChatGoogleInput, "model">
  ) {
    const fields =
      typeof modelOrFields === "string"
        ? { ...(fieldsArg ?? {}), model: modelOrFields }
        : modelOrFields ?? {};
    super(fields);
  }

  buildAbstractedClient(
    fields: GoogleBaseLLMInput<WebGoogleAuthOptions> | undefined
  ): GoogleAbstractedClient {
    return new WebGoogleAuth(fields);
  }
}
