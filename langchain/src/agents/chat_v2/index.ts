import { LLMSingleActionAgent } from "../../agents/agent.js";
import { CreatePromptArgs } from "../../agents/mrkl/index.js";
import { AgentActionOutputParser } from "../../agents/types.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { CallbackManager } from "../../callbacks/base.js";
import { LLMChain } from "../../index.js";
import { Tool } from "../../tools/base.js";
import {
  ChatOutputParser,
  FORMAT_INSTRUCTIONS,
  PREFIX,
  SUFFIX,
  createPrompt,
} from "./prompt.js";

type ChatAgentV2Args = CreatePromptArgs & {
  callbackManager?: CallbackManager;
  stop?: string[];
  outputParser?: AgentActionOutputParser;
  formatInstructions: string;
};

export class ChatAgentV2 extends LLMSingleActionAgent {
  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    args?: ChatAgentV2Args
  ): ChatAgentV2 {
    const {
      callbackManager,
      inputVariables,
      stop,
      outputParser,
      prefix = PREFIX,
      suffix = SUFFIX,
      formatInstructions = FORMAT_INSTRUCTIONS,
    } = args ?? {};
    const _stop = stop || ["Observation:"];
    const _outputParser = outputParser || new ChatOutputParser();

    const prompt = createPrompt({
      tools,
      prefix,
      suffix,
      formatInstructions,
      inputVariables,
    });

    console.log({ prompt });

    const llmChain = new LLMChain({ llm, prompt, callbackManager });

    return new ChatAgentV2({
      llmChain,
      outputParser: _outputParser,
      stop: _stop,
    });
  }

  get agentType(): string {
    return "chat-conversational-react-description-v2";
  }
}
