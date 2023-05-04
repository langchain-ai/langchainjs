import { BaseLanguageModel } from "../base_language/index.js";
import { CallbackManager } from "../callbacks/manager.js";
import { BufferMemory } from "../memory/buffer_memory.js";
import { Tool } from "../tools/base.js";
import { ChatAgent } from "./chat/index.js";
import { ChatConversationalAgent } from "./chat_convo/index.js";
import { AgentExecutor, AgentExecutorInput } from "./executor.js";
import { ZeroShotAgent } from "./mrkl/index.js";

type AgentType =
  | "zero-shot-react-description"
  | "chat-zero-shot-react-description"
  | "chat-conversational-react-description";

/**
 * @deprecated use initializeAgentExecutorWithOptions instead
 */
export const initializeAgentExecutor = async (
  tools: Tool[],
  llm: BaseLanguageModel,
  _agentType?: AgentType,
  _verbose?: boolean,
  _callbackManager?: CallbackManager
): Promise<AgentExecutor> => {
  const agentType = _agentType ?? "zero-shot-react-description";
  const verbose = _verbose;
  const callbackManager = _callbackManager;
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
    default:
      throw new Error("Unknown agent type");
  }
};

/**
 * @interface
 */
export type InitializeAgentExecutorOptions =
  | ({
      agentType: "zero-shot-react-description";
      agentArgs?: Parameters<typeof ZeroShotAgent.fromLLMAndTools>[2];
      memory?: never;
    } & Omit<AgentExecutorInput, "agent" | "tools">)
  | ({
      agentType: "chat-zero-shot-react-description";
      agentArgs?: Parameters<typeof ChatAgent.fromLLMAndTools>[2];
      memory?: never;
    } & Omit<AgentExecutorInput, "agent" | "tools">)
  | ({
      agentType: "chat-conversational-react-description";
      agentArgs?: Parameters<typeof ChatConversationalAgent.fromLLMAndTools>[2];
    } & Omit<AgentExecutorInput, "agent" | "tools">);

/**
 * Initialize an agent executor with options
 * @param tools Array of tools to use in the agent
 * @param llm LLM or ChatModel to use in the agent
 * @param options Options for the agent, including agentType, agentArgs, and other options for AgentExecutor.fromAgentAndTools
 * @returns AgentExecutor
 */
export const initializeAgentExecutorWithOptions = async (
  tools: Tool[],
  llm: BaseLanguageModel,
  options: InitializeAgentExecutorOptions = {
    agentType:
      llm._modelType() === "base_chat_model"
        ? "chat-zero-shot-react-description"
        : "zero-shot-react-description",
  }
): Promise<AgentExecutor> => {
  switch (options.agentType) {
    case "zero-shot-react-description": {
      const { agentArgs, ...rest } = options;
      return AgentExecutor.fromAgentAndTools({
        agent: ZeroShotAgent.fromLLMAndTools(llm, tools, agentArgs),
        tools,
        ...rest,
      });
    }
    case "chat-zero-shot-react-description": {
      const { agentArgs, ...rest } = options;
      return AgentExecutor.fromAgentAndTools({
        agent: ChatAgent.fromLLMAndTools(llm, tools, agentArgs),
        tools,
        ...rest,
      });
    }
    case "chat-conversational-react-description": {
      const { agentArgs, memory, ...rest } = options;
      const executor = AgentExecutor.fromAgentAndTools({
        agent: ChatConversationalAgent.fromLLMAndTools(llm, tools, agentArgs),
        tools,
        memory:
          memory ??
          new BufferMemory({
            returnMessages: true,
            memoryKey: "chat_history",
            inputKey: "input",
          }),
        ...rest,
      });
      return executor;
    }
    default: {
      throw new Error("Unknown agent type");
    }
  }
};
