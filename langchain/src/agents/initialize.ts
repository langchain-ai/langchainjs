import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import type {
  StructuredToolInterface,
  ToolInterface,
} from "@langchain/core/tools";
import { CallbackManager } from "../callbacks/manager.js";
import { BufferMemory } from "../memory/buffer_memory.js";
import { ChatAgent } from "./chat/index.js";
import { ChatConversationalAgent } from "./chat_convo/index.js";
import { StructuredChatAgent } from "./structured_chat/index.js";
import { AgentExecutor, AgentExecutorInput } from "./executor.js";
import { ZeroShotAgent } from "./mrkl/index.js";
import { OpenAIAgent } from "./openai_functions/index.js";
import { XMLAgent } from "./xml/index.js";

/**
 * Represents the type of an agent in LangChain. It can be
 * "zero-shot-react-description", "chat-zero-shot-react-description", or
 * "chat-conversational-react-description".
 */
type AgentType =
  | "zero-shot-react-description"
  | "chat-zero-shot-react-description"
  | "chat-conversational-react-description";

/**
 * @deprecated use initializeAgentExecutorWithOptions instead
 */
export const initializeAgentExecutor = async (
  tools: ToolInterface[],
  llm: BaseLanguageModelInterface,
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
    } & Omit<AgentExecutorInput, "agent" | "tools">)
  | ({
      agentType: "xml";
      agentArgs?: Parameters<typeof XMLAgent.fromLLMAndTools>[2];
    } & Omit<AgentExecutorInput, "agent" | "tools">);

/**
 * @interface
 */
export type InitializeAgentExecutorOptionsStructured =
  | ({
      agentType: "structured-chat-zero-shot-react-description";
      agentArgs?: Parameters<typeof StructuredChatAgent.fromLLMAndTools>[2];
    } & Omit<AgentExecutorInput, "agent" | "tools">)
  | ({
      agentType: "openai-functions";
      agentArgs?: Parameters<typeof OpenAIAgent.fromLLMAndTools>[2];
    } & Omit<AgentExecutorInput, "agent" | "tools">);

/**
 * Initialize an agent executor with options
 * @param tools Array of tools to use in the agent
 * @param llm LLM or ChatModel to use in the agent
 * @param options Options for the agent, including agentType, agentArgs, and other options for AgentExecutor.fromAgentAndTools
 * @returns AgentExecutor
 */
export async function initializeAgentExecutorWithOptions(
  tools: StructuredToolInterface[],
  llm: BaseLanguageModelInterface,
  options: InitializeAgentExecutorOptionsStructured
): Promise<AgentExecutor>;
export async function initializeAgentExecutorWithOptions(
  tools: ToolInterface[],
  llm: BaseLanguageModelInterface,
  options?: InitializeAgentExecutorOptions
): Promise<AgentExecutor>;
export async function initializeAgentExecutorWithOptions(
  tools: StructuredToolInterface[] | ToolInterface[],
  llm: BaseLanguageModelInterface,
  options:
    | InitializeAgentExecutorOptions
    | InitializeAgentExecutorOptionsStructured = {
    agentType:
      llm._modelType() === "base_chat_model"
        ? "chat-zero-shot-react-description"
        : "zero-shot-react-description",
  }
): Promise<AgentExecutor> {
  // Note this tools cast is safe as the overload signatures prevent
  // the function from being called with a StructuredTool[] when
  // the agentType is not in InitializeAgentExecutorOptionsStructured
  switch (options.agentType) {
    case "zero-shot-react-description": {
      const { agentArgs, tags, ...rest } = options;
      return AgentExecutor.fromAgentAndTools({
        tags: [...(tags ?? []), "zero-shot-react-description"],
        agent: ZeroShotAgent.fromLLMAndTools(
          llm,
          tools as ToolInterface[],
          agentArgs
        ),
        tools,
        ...rest,
      });
    }
    case "chat-zero-shot-react-description": {
      const { agentArgs, tags, ...rest } = options;
      return AgentExecutor.fromAgentAndTools({
        tags: [...(tags ?? []), "chat-zero-shot-react-description"],
        agent: ChatAgent.fromLLMAndTools(
          llm,
          tools as ToolInterface[],
          agentArgs
        ),
        tools,
        ...rest,
      });
    }
    case "chat-conversational-react-description": {
      const { agentArgs, memory, tags, ...rest } = options;
      const executor = AgentExecutor.fromAgentAndTools({
        tags: [...(tags ?? []), "chat-conversational-react-description"],
        agent: ChatConversationalAgent.fromLLMAndTools(
          llm,
          tools as ToolInterface[],
          agentArgs
        ),
        tools,
        memory:
          memory ??
          new BufferMemory({
            returnMessages: true,
            memoryKey: "chat_history",
            inputKey: "input",
            outputKey: "output",
          }),
        ...rest,
      });
      return executor;
    }
    case "xml": {
      const { agentArgs, tags, ...rest } = options;
      const executor = AgentExecutor.fromAgentAndTools({
        tags: [...(tags ?? []), "xml"],
        agent: XMLAgent.fromLLMAndTools(
          llm,
          tools as ToolInterface[],
          agentArgs
        ),
        tools,
        ...rest,
      });
      return executor;
    }
    case "structured-chat-zero-shot-react-description": {
      const { agentArgs, memory, tags, ...rest } = options;
      const executor = AgentExecutor.fromAgentAndTools({
        tags: [...(tags ?? []), "structured-chat-zero-shot-react-description"],
        agent: StructuredChatAgent.fromLLMAndTools(llm, tools, agentArgs),
        tools,
        memory,
        ...rest,
      });
      return executor;
    }
    case "openai-functions": {
      const { agentArgs, memory, tags, ...rest } = options;
      const executor = AgentExecutor.fromAgentAndTools({
        tags: [...(tags ?? []), "openai-functions"],
        agent: OpenAIAgent.fromLLMAndTools(llm, tools, agentArgs),
        tools,
        memory:
          memory ??
          new BufferMemory({
            returnMessages: true,
            memoryKey: "chat_history",
            inputKey: "input",
            outputKey: "output",
          }),
        ...rest,
      });
      return executor;
    }
    default: {
      throw new Error("Unknown agent type");
    }
  }
}
