import { BaseChatMessage, ChatMessage } from "../schema/index.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutputValues = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MemoryVariables = Record<string, any>;

export abstract class BaseMemory {
  abstract get memoryKeys(): string[];

  abstract loadMemoryVariables(values: InputValues): Promise<MemoryVariables>;

  abstract saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void>;
}

/**
 * This function is used by memory classes to select the input value
 * to use for the memory. If there is only one input value, it is used.
 * If there are multiple input values, the inputKey must be specified.
 */
export const getInputValue = (inputValues: InputValues, inputKey?: string) => {
  if (inputKey !== undefined) {
    return inputValues[inputKey];
  }
  const keys = Object.keys(inputValues);
  if (keys.length === 1) {
    return inputValues[keys[0]];
  }
  throw new Error(
    `input values have ${keys.length} keys, you must specify an input key or pass only 1 key as input`
  );
};

/**
 * This function is used by memory classes to get a string representation
 * of the chat message history, based on the message content and role.
 */
export function getBufferString(
  baseChatMessagess: BaseChatMessage[],
  humanPrefix = "Human",
  aiPrefix = "AI"
): string {
  const string_messages: string[] = [];
  for (const baseChatMessage of baseChatMessagess) {
    let role: string;
    if (baseChatMessage.isHumanChatMessage()) {
      role = humanPrefix;
    } else if (baseChatMessage.isAIChatMessage()) {
      role = aiPrefix;
    } else if (baseChatMessage.isSystemChatMessage()) {
      role = "System";
    } else if (baseChatMessage.isGenericChatMessage()) {
      role = (baseChatMessage as ChatMessage).role;
    } else {
      throw new Error(`Got unsupported message type: ${baseChatMessage}`);
    }
    string_messages.push(`${role}: ${baseChatMessage.text}`);
  }
  return string_messages.join("\n");
}

export function getPromptInputKey(
  inputs: Record<string, unknown>,
  memoryVariables: string[]
): string {
  const promptInputKeys = Object.keys(inputs).filter(
    (key) => !memoryVariables.includes(key) && key !== "stop"
  );
  if (promptInputKeys.length !== 1) {
    throw new Error(
      `One input key expected, but got ${promptInputKeys.length}`
    );
  }
  return promptInputKeys[0];
}
