import { BaseLLM } from "../../llms";
import { JsonGetValueTool, JsonListKeysTool, JsonSpec, Tool } from "../tools";
import { JSON_PREFIX, JSON_SUFFIX } from "./prompt";
import { LLMChain } from "../../chains";
import { CreatePromptArgs, ZeroShotAgent } from "../mrkl";
import { Toolkit } from "./base";
import { AgentExecutor } from "../executor";

export class JsonToolkit extends Toolkit {
  tools: Tool[];

  constructor(public jsonSpec: JsonSpec) {
    super();
    this.tools = [
      new JsonListKeysTool(jsonSpec),
      new JsonGetValueTool(jsonSpec),
    ];
  }
}

export function createJsonAgent(
  llm: BaseLLM,
  toolkit: JsonToolkit,
  args?: CreatePromptArgs
) {
  const {
    prefix = JSON_PREFIX,
    suffix = JSON_SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
  } = args ?? {};
  const { tools } = toolkit;
  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix,
    suffix,
    inputVariables,
  });
  const chain = new LLMChain({ prompt, llm });
  const agent = new ZeroShotAgent({
    llmChain: chain,
    allowedTools: tools.map((t) => t.name),
  });
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
}
