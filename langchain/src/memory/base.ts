import { BaseMessage, ChatMessage } from "../schema/index.js";
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

const getValue = (values: InputValues | OutputValues, key?: string) => {
  if (key !== undefined) {
    return values[key];
  }
  const keys = Object.keys(values);
  if (keys.length === 1) {
    return values[keys[0]];
  }
};

/**
 * This function is used by memory classes to select the input value
 * to use for the memory. If there is only one input value, it is used.
 * If there are multiple input values, the inputKey must be specified.
 */
export const getInputValue = (inputValues: InputValues, inputKey?: string) => {
  const value = getValue(inputValues, inputKey);
  if (!value) {
    const keys = Object.keys(inputValues);
    throw new Error(
      `input values have ${keys.length} keys, you must specify an input key or pass only 1 key as input`
    );
  }
  return value;
};

/**
 * This function is used by memory classes to select the output value
 * to use for the memory. If there is only one output value, it is used.
 * If there are multiple output values, the outputKey must be specified.
 * If no outputKey is specified, an error is thrown.
 */
export const getOutputValue = (
  outputValues: OutputValues,
  outputKey?: string
) => {
  const value = getValue(outputValues, outputKey);
  if (!value) {
    const keys = Object.keys(outputValues);
    throw new Error(
      `output values have ${keys.length} keys, you must specify an output key or pass only 1 key as output`
    );
  }
  return value;
};

/**
 * This function is used by memory classes to get a string representation
 * of the chat message history, based on the message content and role.
 */
export function getBufferString(
  messages: BaseMessage[],
  humanPrefix = "Human",
  aiPrefix = "AI"
): string {
  const string_messages: string[] = [];
  for (const m of messages) {
    let role: string;
    if (m._getType() === "human") {
      role = humanPrefix;
    } else if (m._getType() === "ai") {
      role = aiPrefix;
    } else if (m._getType() === "system") {
      role = "System";
    } else if (m._getType() === "function") {
      role = "Function";
    } else if (m._getType() === "generic") {
      role = (m as ChatMessage).role;
    } else {
      throw new Error(`Got unsupported message type: ${m}`);
    }
    const nameStr = m.name ? `${m.name}, ` : "";
    string_messages.push(`${role}: ${nameStr}${m.content}`);
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
