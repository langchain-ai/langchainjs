import { ChatOpenAI } from "../../../chat_models/openai.js";
import { ConversationSummaryBufferMemory } from "../../../memory/summary_buffer.js";
import { StructuredTool } from "../../../tools/base.js";
import { initializeAgentExecutorWithOptions } from "../../initialize.js";
import { OpenAIAgentTokenBufferMemory } from "./token_buffer_memory.js";

export type ConversationalRetrievalAgentOptions = {
  rememberIntermediateSteps?: boolean;
  memoryKey?: string;
  outputKey?: string;
  prefix?: string;
  verbose?: boolean;
};

export async function createConversationalRetrievalAgent(
  llm: ChatOpenAI,
  tools: StructuredTool[],
  options?: ConversationalRetrievalAgentOptions
) {
  const {
    rememberIntermediateSteps = true,
    memoryKey = "chat_history",
    outputKey = "output",
    prefix,
    verbose,
  } = options ?? {};
  let memory;
  if (rememberIntermediateSteps) {
    memory = new OpenAIAgentTokenBufferMemory({
      memoryKey,
      llm,
      outputKey,
    });
  } else {
    memory = new ConversationSummaryBufferMemory({
      memoryKey,
      llm,
      maxTokenLimit: 12000,
      returnMessages: true,
      outputKey,
    });
  }
  const executor = await initializeAgentExecutorWithOptions(tools, llm, {
    agentType: "openai-functions",
    memory,
    verbose,
    returnIntermediateSteps: rememberIntermediateSteps,
    agentArgs: {
      prefix:
        prefix ??
        `Do your best to answer the questions. Feel free to use any tools available to look up relevant information, only if necessary.`,
    },
  });
  return executor;
}
