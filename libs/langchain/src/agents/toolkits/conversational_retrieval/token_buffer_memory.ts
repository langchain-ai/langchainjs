import type { ChatOpenAI } from "@langchain/openai";
import {
  InputValues,
  MemoryVariables,
  OutputValues,
  getInputValue,
  getOutputValue,
} from "@langchain/core/memory";
import {
  type BaseMessage,
  getBufferString,
  AIMessage,
  FunctionMessage,
} from "@langchain/core/messages";
import { AgentAction, AgentStep } from "@langchain/core/agents";
import {
  BaseChatMemory,
  BaseChatMemoryInput,
} from "../../../memory/chat_memory.js";

/**
 * Type definition for the fields required to initialize an instance of
 * OpenAIAgentTokenBufferMemory.
 */
export type OpenAIAgentTokenBufferMemoryFields = BaseChatMemoryInput & {
  llm: ChatOpenAI;
  humanPrefix?: string;
  aiPrefix?: string;
  memoryKey?: string;
  maxTokenLimit?: number;
  returnMessages?: boolean;
  outputKey?: string;
  intermediateStepsKey?: string;
};

/**
 * Memory used to save agent output and intermediate steps.
 */
export class OpenAIAgentTokenBufferMemory extends BaseChatMemory {
  humanPrefix = "Human";

  aiPrefix = "AI";

  llm: ChatOpenAI;

  memoryKey = "history";

  maxTokenLimit = 12000;

  returnMessages = true;

  outputKey = "output";

  intermediateStepsKey = "intermediateSteps";

  constructor(fields: OpenAIAgentTokenBufferMemoryFields) {
    super(fields);
    this.humanPrefix = fields.humanPrefix ?? this.humanPrefix;
    this.aiPrefix = fields.aiPrefix ?? this.aiPrefix;
    this.llm = fields.llm;
    this.memoryKey = fields.memoryKey ?? this.memoryKey;
    this.maxTokenLimit = fields.maxTokenLimit ?? this.maxTokenLimit;
    this.returnMessages = fields.returnMessages ?? this.returnMessages;
    this.outputKey = fields.outputKey ?? this.outputKey;
    this.intermediateStepsKey =
      fields.intermediateStepsKey ?? this.intermediateStepsKey;
  }

  get memoryKeys(): string[] {
    return [this.memoryKey];
  }

  /**
   * Retrieves the messages from the chat history.
   * @returns Promise that resolves with the messages from the chat history.
   */
  async getMessages(): Promise<BaseMessage[]> {
    return this.chatHistory.getMessages();
  }

  /**
   * Loads memory variables from the input values.
   * @param _values Input values.
   * @returns Promise that resolves with the loaded memory variables.
   */
  async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
    const buffer = await this.getMessages();
    if (this.returnMessages) {
      return { [this.memoryKey]: buffer };
    } else {
      const bufferString = getBufferString(
        buffer,
        this.humanPrefix,
        this.aiPrefix
      );
      return { [this.memoryKey]: bufferString };
    }
  }

  /**
   * Saves the context of the chat, including user input, AI output, and
   * intermediate steps. Prunes the chat history if the total token count
   * exceeds the maximum limit.
   * @param inputValues Input values.
   * @param outputValues Output values.
   * @returns Promise that resolves when the context has been saved.
   */
  async saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void> {
    const inputValue = getInputValue(inputValues, this.inputKey);
    const outputValue = getOutputValue(outputValues, this.outputKey);
    await this.chatHistory.addUserMessage(inputValue);
    const intermediateStepMessages = _formatIntermediateSteps(
      outputValues[this.intermediateStepsKey]
    );
    for (const message of intermediateStepMessages) {
      await this.chatHistory.addMessage(message);
    }
    await this.chatHistory.addAIChatMessage(outputValue);
    const currentMessages = await this.chatHistory.getMessages();
    let tokenInfo = await this.llm.getNumTokensFromMessages(currentMessages);
    if (tokenInfo.totalCount > this.maxTokenLimit) {
      const prunedMemory = [];
      while (tokenInfo.totalCount > this.maxTokenLimit) {
        const retainedMessage = currentMessages.pop();
        if (!retainedMessage) {
          console.warn(
            `Could not prune enough messages from chat history to stay under ${this.maxTokenLimit} tokens.`
          );
          break;
        }
        prunedMemory.push(retainedMessage);
        tokenInfo = await this.llm.getNumTokensFromMessages(currentMessages);
      }
      await this.chatHistory.clear();
      for (const message of prunedMemory) {
        await this.chatHistory.addMessage(message);
      }
    }
  }
}

function _convertAgentStepToMessages(
  action: AgentAction | FunctionsAgentAction,
  observation: string
) {
  if (isFunctionsAgentAction(action) && action.messageLog !== undefined) {
    return action.messageLog?.concat(
      new FunctionMessage(observation, action.tool)
    );
  } else {
    return [new AIMessage(action.log)];
  }
}

export function _formatIntermediateSteps(
  intermediateSteps: AgentStep[]
): BaseMessage[] {
  return intermediateSteps.flatMap(({ action, observation }) =>
    _convertAgentStepToMessages(action, observation)
  );
}

/**
 * Type that represents an agent action with an optional message log.
 */
export type FunctionsAgentAction = AgentAction & {
  messageLog?: BaseMessage[];
};

/**
 * Checks if the given action is a FunctionsAgentAction.
 * @param action The action to check.
 * @returns True if the action is a FunctionsAgentAction, false otherwise.
 */
function isFunctionsAgentAction(
  action: AgentAction | FunctionsAgentAction
): action is FunctionsAgentAction {
  return (action as FunctionsAgentAction).messageLog !== undefined;
}
