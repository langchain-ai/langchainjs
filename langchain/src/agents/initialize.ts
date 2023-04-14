import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManager, getCallbackManager } from "../callbacks/index.js";
import { Tool } from "../tools/base.js";
import { ChatAgent } from "./chat/index.js";
import { ChatConversationalAgent } from "./chat_convo/index.js";
import { ChatAgentV2 } from "./chat_v2/index.js";
import { AgentExecutor } from "./executor.js";
import { ZeroShotAgent } from "./mrkl/index.js";

type AgentType =
  | "zero-shot-react-description"
  | "chat-zero-shot-react-description"
  | "chat-conversational-react-description"
  | "chat-conversational-react-description-v2";

export const initializeAgentExecutor = async (
  tools: Tool[],
  llm: BaseLanguageModel,
  _agentType?: AgentType,
  _verbose?: boolean,
  _callbackManager?: CallbackManager
): Promise<AgentExecutor> => {
  const agentType = _agentType ?? "zero-shot-react-description";
  const verbose = _verbose ?? !!_callbackManager;
  const callbackManager = _callbackManager ?? getCallbackManager();
  switch (agentType) {
    case "zero-shot-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ZeroShotAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
        verbose,
        callbackManager,
      });
    case "chat-zero-shot-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ChatAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
        verbose,
        callbackManager,
      });
    case "chat-conversational-react-description":
      return AgentExecutor.fromAgentAndTools({
        agent: ChatConversationalAgent.fromLLMAndTools(llm, tools),
        tools,
        verbose,
        callbackManager,
      });

    case "chat-conversational-react-description-v2":
      return AgentExecutor.fromAgentAndTools({
        agent: ChatAgentV2.fromLLMAndTools(llm, tools),
        tools,
        verbose,
        callbackManager,
      });
    default:
      throw new Error("Unknown agent type");
  }
};
