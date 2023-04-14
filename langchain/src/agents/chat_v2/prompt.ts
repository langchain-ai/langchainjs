import { AgentScratchPadChatPromptTemplate } from "../../agents/schema.js";
import { AgentActionOutputParser } from "../../agents/types.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/chat.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";
import { Tool } from "../../tools/base.js";

export const PREFIX = `Answer the following questions as best you can. You have access to the following tools:`;
export const FORMAT_INSTRUCTIONS = `The way you use the tools is by specifying a json blob, denoted below by $JSON_BLOB
Specifically, this $JSON_BLOB should have a "action" key (with the name of the tool to use) and a "action_input" key (with the input to the tool going here). 
The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:

\`\`\`
{{
  "action": "calculator",
  "action_input": "1 + 2"
}}
\`\`\`

ALWAYS use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: 
\`\`\`
$JSON_BLOB
\`\`\`
Observation: the result of the action
... (this Thought/Action/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;
export const SUFFIX = `Begin! Reminder to always use the exact characters \`Final Answer\` when responding.`;

export const createPrompt = ({
  tools,
  prefix = PREFIX,
  suffix = SUFFIX,
  formatInstructions = FORMAT_INSTRUCTIONS,
  inputVariables,
}: {
  tools: Tool[];
  prefix: string;
  suffix: string;
  formatInstructions: string;
  inputVariables?: string[];
}): BasePromptTemplate => {
  const toolSummaries = tools
    .map((tool) => `${tool.name}: ${tool.description}`)
    .join("\n");

  const toolNames = tools.map((tool) => tool.name).join(", ");

  const formatInstructionsWithTools = formatInstructions.replace(
    "{tool_names}",
    toolNames
  );

  const template = [
    prefix,
    toolSummaries,
    formatInstructionsWithTools,
    suffix,
  ].join("\n\n");
  const messages = [
    SystemMessagePromptTemplate.fromTemplate(template),
    HumanMessagePromptTemplate.fromTemplate("{input}\n\n{agent_scratchpad}"),
  ];

  return new AgentScratchPadChatPromptTemplate({
    promptMessages: messages,
    inputVariables: inputVariables ?? ["input", "intermediate_steps"],
  });
};

export class ChatOutputParser extends AgentActionOutputParser {
  async parse(text: string): Promise<AgentAction | AgentFinish> {
    if (text.includes("Final Answer:")) {
      const output = text.split("Final Answer:").pop()?.trim() || "";

      // Return values is generally always a dictionary with a single `output` key
      // It is not recommended to try anything else at the moment :)
      return { returnValues: { output }, log: text };
    }

    try {
      const [, action] = text.split("```");
      const response = JSON.parse(action.trim());
      const agentAction: AgentAction = {
        tool: response.action,
        toolInput: response.action_input,
        log: text,
      };

      return agentAction;
    } catch (error) {
      throw new Error(`Could not parse LLM output: ${text}`);
    }
  }

  getFormatInstructions(): string {
    throw new Error("_type not implemented");
  }
}
