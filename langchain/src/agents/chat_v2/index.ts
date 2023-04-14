import { LLMSingleActionAgent } from "../../agents/agent.js";
import { CreatePromptArgs } from "../../agents/mrkl/index.js";
import { AgentActionOutputParser } from "../../agents/types.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { CallbackManager } from "../../callbacks/base.js";
import { LLMChain } from "../../index.js";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
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
      stop = ["Observation:"],
      outputParser = new ChatOutputParser(),
      prefix = PREFIX,
      suffix = SUFFIX,
      formatInstructions = FORMAT_INSTRUCTIONS,
    } = args ?? {};

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

  /**
   * Create prompt in the style of the zero shot agent.
   *
   * @param tools - List of tools the agent will have access to, used to format the prompt.
   * @param args - Arguments to create the prompt with.
   * @param args.suffix - String to put after the list of tools.
   * @param args.prefix - String to put before the list of tools.
   */
  static createPrompt(tools: Tool[], args?: CreatePromptArgs) {
    const { prefix = PREFIX, suffix = SUFFIX } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const template = [prefix, toolStrings, FORMAT_INSTRUCTIONS, suffix].join(
      "\n\n"
    );
    const messages = [
      SystemMessagePromptTemplate.fromTemplate(template),
      HumanMessagePromptTemplate.fromTemplate("{input}\n\n{agent_scratchpad}"),
    ];
    return ChatPromptTemplate.fromPromptMessages(messages);
  }
}
