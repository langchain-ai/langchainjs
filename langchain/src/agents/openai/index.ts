import { ChatOpenAI } from "../../chat_models/openai.js";
import {
  AIChatMessage,
  AgentAction,
  AgentFinish,
  AgentStep,
  BaseChatMessage,
  HumanChatMessage,
  SystemChatMessage,
} from "../../schema/index.js";
import { BaseSingleActionAgent } from "../agent.js";

function _parse_ai_message(message: AIChatMessage): AgentAction | AgentFinish {
  const message_lines = message.split("\n");
  const tool_name = message_lines[0].trim();
  const tool_input = message_lines[1].trim();
  const content = message_lines.slice(2).join("\n").trim();

  if (tool_name === "respond") {
    return {
      returnValues: { content },
      log: message,
    };
  } else {
    return {
      tool: tool_name,
      toolInput: tool_input,
      log: message,
    };
  }
}

function _format_intermediate_steps(
  intermediate_steps: Array<AgentStep>
): Array<HumanChatMessage> {
  return intermediate_steps.flatMap(({ action, observation }) => {
    const log = action.log || "";
    const content = observation || "";
    return [new SystemChatMessage(log), new HumanChatMessage(content)];
  });
}

function _generate_prompt(user_input: string): Array<BaseChatMessage> {
  return [
    new SystemChatMessage("You are a helpful AI assistant. "),
    new HumanChatMessage(
      "Answer the following question to the best of your ability using tools. " +
        "---" +
        "You live in an alternate universe where some of what you take " +
        "for granted may not be true (such as mathematical or historical facts)" +
        "So rely heavily on the content of tools." +
        "---" +
        "If you do not have enough information to answer the question, " +
        "and do not believe you can gain relevant information using the tools, " +
        "respond appropriately using the respond tool " +
        "(saying question cannot be answered). "
    ),
    new HumanChatMessage(user_input),
  ];
}

export class OpenAIAgent extends BaseSingleActionAgent {
  lc_namespace = ["langchain", "agents", "openai"];

  llm: ChatOpenAI;

  allowed_tools?: Array<string>;

  get allowedTools(): Array<string> {
    return this.allowed_tools || [];
  }

  get inputKeys(): Array<string> {
    return ["input"];
  }

  async plan(
    intermediateSteps: Array<AgentStep>,
    kwargs: any
  ): Promise<AgentAction | AgentFinish> {
    const { tools, input: user_input } = kwargs;
    const messages = _generate_prompt(user_input);
    messages.push(..._format_intermediate_steps(intermediateSteps));
    const predicted_message = await this.llm.predictMessages(messages, {
      tools,
    });
    const agent_decision = _parse_ai_message(predicted_message);
    return agent_decision;
  }
}
