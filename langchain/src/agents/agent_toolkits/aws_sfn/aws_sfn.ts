import { Tool } from "../../../tools/base.js";
import {
  SfnConfig,
  StartExecutionAWSSfnTool,
  DescribeExecutionAWSSfnTool,
  SendTaskSuccessAWSSfnTool,
} from "../../../tools/aws_sfn.js";
import { Toolkit } from "../base.js";
import { BaseLanguageModel } from "../../../base_language/index.js";
import { SFN_PREFIX, SFN_SUFFIX } from "./prompt.js";
import { renderTemplate } from "../../../prompts/template.js";
import { LLMChain } from "../../../chains/llm_chain.js";
import { ZeroShotAgent, ZeroShotCreatePromptArgs } from "../../mrkl/index.js";
import { AgentExecutor } from "../../executor.js";

export interface AWSSfnCreatePromptArgs extends ZeroShotCreatePromptArgs {}

export interface AWSSfnToolkitArgs {
  name: string;
  description: string;
  stateMachineArn: string;
  asl?: string;
  llm?: BaseLanguageModel;
}

export class AWSSfnToolkit extends Toolkit {
  tools: Tool[];

  stateMachineArn: string;

  asl: string;

  constructor(args: AWSSfnToolkitArgs & SfnConfig) {
    super();
    this.stateMachineArn = args.stateMachineArn;
    if (args.asl) {
      this.asl = args.asl;
    }
    this.tools = [
      new StartExecutionAWSSfnTool({
        name: args.name,
        description: StartExecutionAWSSfnTool.getDescription(
          args.name,
          args.description
        ),
        stateMachineArn: args.stateMachineArn,
      }),
      new DescribeExecutionAWSSfnTool(
        Object.assign(
          args.region ? { region: args.region } : {},
          args.accessKeyId && args.secretAccessKey
            ? {
                accessKeyId: args.accessKeyId,
                secretAccessKey: args.secretAccessKey,
              }
            : {}
        )
      ),
      new SendTaskSuccessAWSSfnTool(
        Object.assign(
          args.region ? { region: args.region } : {},
          args.accessKeyId && args.secretAccessKey
            ? {
                accessKeyId: args.accessKeyId,
                secretAccessKey: args.secretAccessKey,
              }
            : {}
        )
      ),
    ];
  }
}

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
