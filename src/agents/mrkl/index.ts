import { BaseLLM } from "../../llms";
import { LLMChain } from "../../chains";
import {
  Agent,
  Tool,
  AgentInput,
  StaticAgent,
  staticImplements,
  SerializedAgentT,
} from "../index";
import { PromptTemplate } from "../../prompt";
import { PREFIX, SUFFIX, formatInstructions } from "./prompt";
import { deserializeHelper } from "../helpers";

const FINAL_ANSWER_ACTION = "Final Answer:";

type SerializedFromLLMAndTools = {
  suffix?: string;
  prefix?: string;
  input_variables?: string[];
};

export type SerializedZeroShotAgent = SerializedAgentT<
  "zero-shot-react-description",
  SerializedFromLLMAndTools,
  AgentInput
>;

type CreatePromptArgs = {
  suffix?: string;
  prefix?: string;
  inputVariables?: string[];
};

type ZeroShotAgentInput = AgentInput;

@(staticImplements<StaticAgent>)
export class ZeroShotAgent extends Agent {
  constructor(input: ZeroShotAgentInput) {
    super(input);
  }

  _agentType() {
    return "zero-shot-react-description" as const;
  }

  observationPrefix() {
    return "Observation: ";
  }

  llmPrefix() {
    return "Thought:";
  }

  static validateTools(tools: Tool[]) {
    const invalidTool = tools.find((tool) => !tool.description);
    if (invalidTool) {
      const msg =
        `Got a tool ${invalidTool.name} without a description.` +
        ` This agent requires descriptions for all tools.`;
      throw new Error(msg);
    }
  }

  static createPrompt(tools: Tool[], args?: CreatePromptArgs) {
    const {
      prefix = PREFIX,
      suffix = SUFFIX,
      inputVariables = ["input", "agent_scratchpad"],
    } = args ?? {};
    const toolStrings = tools
      .map((tool) => `${tool.name}: ${tool.description}`)
      .join("\n");
    const instructions = formatInstructions(toolStrings);
    const template = [prefix, toolStrings, instructions, suffix].join("\n\n");

    return new PromptTemplate({
      template,
      inputVariables,
    });
  }

  static fromLLMAndTools(llm: BaseLLM, tools: Tool[], args?: CreatePromptArgs) {
    ZeroShotAgent.validateTools(tools);
    const prompt = ZeroShotAgent.createPrompt(tools, args);
    const chain = new LLMChain({ prompt, llm });
    return new ZeroShotAgent({
      llmChain: chain,
      allowedTools: tools.map((t) => t.name),
    });
  }

  extractToolAndInput(text: string): { tool: string; input: string } | null {
    if (text.includes(FINAL_ANSWER_ACTION)) {
      const parts = text.split(FINAL_ANSWER_ACTION);
      const input = parts[parts.length - 1].trim();
      return { tool: "Final Answer", input };
    }

    const match = /Action: (.*)\nAction Input: (.*)/s.exec(text);
    if (!match) {
      throw new Error(`Could not parse LLM output: ${text}`);
    }

    return {
      tool: match[1].trim(),
      input: match[2].trim().replace(/^"+|"+$/g, ""),
    };
  }

  static async deserialize(
    data: SerializedZeroShotAgent & { llm?: BaseLLM; tools?: Tool[] }
  ): Promise<ZeroShotAgent> {
    const { llm, tools, ...rest } = data;
    return deserializeHelper(
      llm,
      tools,
      rest,
      (llm: BaseLLM, tools: Tool[], args: SerializedFromLLMAndTools) =>
        ZeroShotAgent.fromLLMAndTools(llm, tools, {
          prefix: args.prefix,
          suffix: args.suffix,
          inputVariables: args.input_variables,
        }),
      (args) => new ZeroShotAgent(args)
    );
  }
}
