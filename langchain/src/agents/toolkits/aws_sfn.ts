import {
  type AWSSfnToolkitArgs,
  AWSSfnToolkit,
} from "@langchain/community/agents/toolkits/aws_sfn";
import { BaseLanguageModel } from "../../base_language/index.js";
import { renderTemplate } from "../../prompts/template.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { ZeroShotAgent, ZeroShotCreatePromptArgs } from "../mrkl/index.js";
import { AgentExecutor } from "../executor.js";

export { AWSSfnToolkit, type AWSSfnToolkitArgs };

export const SFN_PREFIX = `You are an agent designed to interact with AWS Step Functions state machines to execute and coordinate asynchronous workflows and tasks.
Given an input question, command, or task use the appropriate tool to execute a command to interact with AWS Step Functions and return the result.
You have access to tools for interacting with AWS Step Functions.
Given an input question, command, or task use the correct tool to complete the task.
Only use the below tools. Only use the information returned by the below tools to construct your final answer.

If the question does not seem related to AWS Step Functions or an existing state machine, just return "I don't know" as the answer.`;

export const SFN_SUFFIX = `Begin!

Question: {input}
Thought: I should look at state machines within AWS Step Functions to see what actions I can perform.
{agent_scratchpad}`;

export interface AWSSfnCreatePromptArgs extends ZeroShotCreatePromptArgs {}

export function createAWSSfnAgent(
  llm: BaseLanguageModel,
  toolkit: AWSSfnToolkit,
  args?: AWSSfnCreatePromptArgs
) {
  const {
    prefix = SFN_PREFIX,
    suffix = SFN_SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
  } = args ?? {};
  const { tools } = toolkit;
  const formattedPrefix = renderTemplate(prefix, "f-string", {});

  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix: formattedPrefix,
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
