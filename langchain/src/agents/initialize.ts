import { Tool } from "./tools/index.js";
import { BaseLLM } from "../llms/index.js";
import { AgentExecutor } from "./executor.js";
import { ZeroShotAgent } from "./mrkl/index.js";

export const initializeAgentExecutor = async (
  tools: Tool[],
  llm: BaseLLM,
  agentType = "zero-shot-react-description"
): Promise<AgentExecutor> => {
  switch (agentType) {
    case "zero-shot-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ZeroShotAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
      });
    default:
      throw new Error("Unknown agent type");
  }
};
