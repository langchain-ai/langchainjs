import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatResult } from "@langchain/core/outputs";
import {
  BaseChatModel,
  BaseChatModelCallOptions,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

export interface AdvancedCustomChatModelOptions
  extends BaseChatModelCallOptions {}

export interface AdvancedCustomChatModelParams extends BaseChatModelParams {
  n: number;
}

export class AdvancedCustomChatModel extends BaseChatModel<AdvancedCustomChatModelOptions> {
  n: number;

  static lc_name(): string {
    return "AdvancedCustomChatModel";
  }

  constructor(fields: AdvancedCustomChatModelParams) {
    super(fields);
    this.n = fields.n;
  }

  async _generate(
    messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    if (!messages.length) {
      throw new Error("No messages provided.");
    }
    if (typeof messages[0].content !== "string") {
      throw new Error("Multimodal messages are not supported.");
    }
    const content = messages[0].content.slice(0, this.n);
    const tokenUsage = {
      usedTokens: this.n,
    };
    return {
      generations: [{ message: new AIMessage({ content }), text: content }],
      llmOutput: { tokenUsage },
    };
  }

  _llmType(): string {
    return "advanced_custom_chat_model";
  }
}

const chatModel = new AdvancedCustomChatModel({ n: 4 });

console.log(await chatModel.invoke([["human", "I am an LLM"]]));

const eventStream = await chatModel.streamEvents([["human", "I am an LLM"]], {
  version: "v1",
});
for await (const event of eventStream) {
  if (event.event === "on_llm_end") {
    console.log(JSON.stringify(event, null, 2));
  }
}
