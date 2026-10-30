import { ChatGoogleBase, ChatGoogleBaseInput } from "../chat_models.js";
import { GoogleAbstractedClient } from "../auth.js";
import { GoogleAIBaseLLMInput } from "../types.js";
import { authOptions, MockClient, type MockClientAuthInfo } from "./mock.js";

export class TestChatGoogle extends ChatGoogleBase<MockClientAuthInfo> {
  constructor(fields?: ChatGoogleBaseInput<MockClientAuthInfo>) {
    super(fields);
  }

  buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<MockClientAuthInfo>
  ): GoogleAbstractedClient {
    return new MockClient(authOptions(fields));
  }

  buildApiKey(
    _fields?: GoogleAIBaseLLMInput<MockClientAuthInfo>
  ): string | undefined {
    return undefined;
  }
}
