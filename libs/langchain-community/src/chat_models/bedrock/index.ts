import {
  defaultProvider,
  DefaultProviderInit,
} from "@aws-sdk/credential-provider-node";

import type { BaseChatModelParams } from "@langchain/core/language_models/chat_models";

import { BaseBedrockInput } from "../../utils/bedrock/index.js";
import { BedrockChat as BaseBedrockChat } from "./web.js";

export interface BedrockChatFields
  extends Partial<BaseBedrockInput>,
    BaseChatModelParams,
    Partial<DefaultProviderInit> {}

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

  constructor(fields?: BedrockChatFields) {
    const {
      profile,
      filepath,
      configFilepath,
      ignoreCache,
      mfaCodeProvider,
      roleAssumer,
      roleArn,
      webIdentityTokenFile,
      roleAssumerWithWebIdentity,
      ...rest
    } = fields ?? {};
    super({
      ...rest,
      credentials:
        rest?.credentials ??
        defaultProvider({
          profile,
          filepath,
          configFilepath,
          ignoreCache,
          mfaCodeProvider,
          roleAssumer,
          roleArn,
          webIdentityTokenFile,
          roleAssumerWithWebIdentity,
        }),
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
