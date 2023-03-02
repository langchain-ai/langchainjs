import { BaseLLM } from "../llms/index.js";
import { AgentExecutor } from "./executor.js";
import { CreatePromptArgs, ZeroShotAgent } from "./mrkl/index.js";
import { Tool } from "./tools/index.js";

export interface InitializeAgentExecutorOptions {
  tools: Tool[];
  llm: BaseLLM;
  agentType?: "zero-shot-react-description";
  promptArgs?: CreatePromptArgs;
}

export const initializeAgentExecutor = async ({
  tools,
  llm,
  agentType: _agentType,
  promptArgs,
}: InitializeAgentExecutorOptions): Promise<AgentExecutor> => {
  const agentType = _agentType || "zero-shot-react-description";

  switch (agentType) {
    case "zero-shot-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ZeroShotAgent.fromLLMAndTools(llm, tools, promptArgs),
        tools,
        returnIntermediateSteps: true,
      });
    default:
      throw new Error("Unknown agent type");
  }
};
