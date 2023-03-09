import { Tool } from "./tools/index.js";
import { BaseLanguageModel } from "../schema/index.js";
import { AgentExecutor } from "./executor.js";
import { ZeroShotAgent } from "./mrkl/index.js";
import { ChatAgent } from "./chat/index.js";

export const initializeAgentExecutor = async (
  tools: Tool[],
  llm: BaseLanguageModel,
  agentType = "zero-shot-react-description"
): Promise<AgentExecutor> => {
  switch (agentType) {
    case "zero-shot-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ZeroShotAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
      });
    case "chat-zero-shot-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ChatAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
      });
    default:
      throw new Error("Unknown agent type");
  }
};
