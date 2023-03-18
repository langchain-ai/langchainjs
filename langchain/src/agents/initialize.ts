import { Tool } from "./tools/index.js";
import { AgentExecutor } from "./executor.js";
import { ZeroShotAgent } from "./mrkl/index.js";
import { ChatConversationalAgent } from "./chat_convo/index.js";
import { ChatAgent } from "./chat/index.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManager, getCallbackManager } from "../callbacks/index.js";
import { BufferMemory } from "../memory/buffer_memory.js";

export const initializeAgentExecutor = async (
  tools: Tool[],
  llm: BaseLanguageModel,
  agentType = "zero-shot-react-description",
  verbose = false,
  callbackManager: CallbackManager = getCallbackManager()
): Promise<AgentExecutor> => {
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
        callbackManager
      });
    default:
      throw new Error("Unknown agent type");
  }
};

export const initializeAgentExecutorWithOptions = async (
  tools: Tool[],
  llm: BaseLanguageModel,
  options: {
    agentType?: string,
    prompt?: string,
    verbose?: boolean,
    callbackManager?: CallbackManager
  }
): Promise<AgentExecutor> => {
  const agentType = options.agentType ?? "zero-shot-react-description";
  const verbose = options.verbose ?? false;
  const callbackManager = options.callbackManager ?? getCallbackManager();
  switch (agentType) {
    case "zero-shot-react-description": {
      return AgentExecutor.fromAgentAndTools({
        agent: ZeroShotAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
        verbose,
        callbackManager,
      });
    }
    case "chat-zero-shot-react-description": {
      return AgentExecutor.fromAgentAndTools({
        agent: ChatAgent.fromLLMAndTools(llm, tools),
        tools,
        returnIntermediateSteps: true,
        verbose,
        callbackManager,
      });
    }
    case "chat-conversational-react-description": {
      const executor = AgentExecutor.fromAgentAndTools({
        agent: ChatConversationalAgent.fromLLMAndTools(llm, tools, {
          prefix: options.prompt
        }),
        tools,
        verbose,
        callbackManager
      });
      executor.memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
      });
      return executor;
    }
    default: {
      throw new Error("Unknown agent type");
    }
  }
};
