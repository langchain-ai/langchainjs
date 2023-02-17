import { Tool } from "./tools";
import { BaseLLM } from "../llms";
import { AgentExecutor } from "./executor";
import { ZeroShotAgent } from "./mrkl";
export const initializeAgentExecutor = async (
    tools: Tool[],
    llm: BaseLLM,
    agentType= "zero-shot-react-description"
  ): Promise<AgentExecutor> => {
    switch (agentType) {
        case "zero-shot-react-description":
            const agent = ZeroShotAgent.fromLLMAndTools(llm, tools);
            const executor = AgentExecutor.fromAgentAndTools({
                agent,
                tools,
                returnIntermediateSteps: true,
                });
                return executor
        default:
            throw new Error("Unknown agent type");
    }
  };