import { BaseLLM } from "../../llms";
import {
  DynamicTool,
  JsonSpec,
  RequestsGetTool,
  RequestsPostTool,
  Tool,
} from "../tools";
import { AgentExecutor } from "../executor";
import {
  OPENAPI_PREFIX,
  OPENAPI_SUFFIX,
  JSON_EXPLORER_DESCRIPTION,
} from "./prompt";
import { LLMChain } from "../../chains";
import { CreatePromptArgs, ZeroShotAgent } from "../mrkl";
import { Toolkit } from "./base";
import { Headers } from "../tools/requests";
import { createJsonAgent, JsonToolkit } from "./json";

export class RequestsToolkit extends Toolkit {
  tools: Tool[];

  constructor(headers?: Headers) {
    super();
    this.tools = [new RequestsGetTool(headers), new RequestsPostTool(headers)];
  }
}

export class OpenApiToolkit extends RequestsToolkit {
  constructor(jsonSpec: JsonSpec, llm: BaseLLM, headers?: Headers) {
    super(headers);
    const jsonAgent = createJsonAgent(llm, new JsonToolkit(jsonSpec));
    this.tools = [
      ...this.tools,
      new DynamicTool({
        name: "json_explorer",
        func: async (input: string) => {
          const result = await jsonAgent.call({ input });
          return result.output as string;
        },
        description: JSON_EXPLORER_DESCRIPTION,
      }),
    ];
  }
}

export function createOpenApiAgent(
  llm: BaseLLM,
  openApiToolkit: OpenApiToolkit,
  args?: CreatePromptArgs
) {
  const {
    prefix = OPENAPI_PREFIX,
    suffix = OPENAPI_SUFFIX,
    inputVariables = ["input", "agent_scratchpad"],
  } = args ?? {};

  const { tools } = openApiToolkit;
  const prompt = ZeroShotAgent.createPrompt(tools, {
    prefix,
    suffix,
    inputVariables,
  });
  const chain = new LLMChain({
    prompt,
    llm,
  });
  const toolNames = tools.map((tool) => tool.name);
  const agent = new ZeroShotAgent({ llmChain: chain, allowedTools: toolNames });
  return AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    returnIntermediateSteps: true,
  });
}
