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

type ChatAgentV2Options = CreatePromptArgs & {
  callbackManager?: CallbackManager;
  stop?: string[];
  outputParser?: AgentActionOutputParser;
  formatInstructions?: string;
};

export class ChatAgentV2 extends LLMSingleActionAgent {
  static fromLLMAndTools(
    llm: BaseLanguageModel,
    tools: Tool[],
    options?: ChatAgentV2Options
  ): ChatAgentV2 {
    const {
      callbackManager,
      inputVariables,
      stop = ["Observation:"],
      outputParser = new ChatOutputParser(),
      prefix = PREFIX,
      suffix = SUFFIX,
      formatInstructions = FORMAT_INSTRUCTIONS,
    } = options ?? {};

    const prompt = createPrompt({
      tools,
      prefix,
      suffix,
      formatInstructions,
      inputVariables,
    });

    const llmChain = new LLMChain({ llm, prompt, callbackManager });

    return new ChatAgentV2({
      llmChain,
      outputParser,
      stop,
    });
  }

  get agentType(): string {
    return "chat-zero-shot-react-description-v2";
  }
}
