import { BaseLLM } from "../../../llms/index.js";
import {
  JsonGetValueTool,
  JsonListKeysTool,
  JsonSpec,
  Tool,
} from "../../tools/index.js";
import { JSON_PREFIX, JSON_SUFFIX } from "./prompt.js";
import { LLMChain } from "../../../chains/index.js";
import { CreatePromptArgs, ZeroShotAgent } from "../../mrkl/index.js";
import { Toolkit } from "../base.js";
import { AgentExecutor } from "../../executor.js";

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
