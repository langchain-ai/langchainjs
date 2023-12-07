import { defaultProvider } from "@aws-sdk/credential-provider-node";

import type { BaseChatModelParams } from "@langchain/core/language_models/chat_models";

import { BaseBedrockInput } from "../../utils/bedrock.js";
import { BedrockChat as BaseBedrockChat } from "./web.js";

/**
 * @example
 * ```typescript
 * const model = new BedrockChat({
 *   model: "anthropic.claude-v2",
 *   region: "us-east-1",
 * });
 * const res = await model.invoke([{ content: "Tell me a joke" }]);
 * console.log(res);
 * ```
 */
export class BedrockChat extends BaseBedrockChat {
  static lc_name() {
    return "BedrockChat";
  }

  constructor(fields?: Partial<BaseBedrockInput> & BaseChatModelParams) {
    super({
      ...fields,
      credentials: fields?.credentials ?? defaultProvider(),
    });
  }
}

export {
  convertMessagesToPromptAnthropic,
  convertMessagesToPrompt,
} from "./web.js";

/**
 * @deprecated Use `BedrockChat` instead.
 */
export const ChatBedrock = BedrockChat;
