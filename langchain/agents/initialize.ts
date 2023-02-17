import { Tool } from "./tools";
import { BaseLLM } from "../llms";
import { AgentExecutor } from "./executor";
import { ZeroShotAgent } from "./mrkl";

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
