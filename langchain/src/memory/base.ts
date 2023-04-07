import { BaseChatMessage, ChatMessage } from "../schema/index.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutputValues = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MemoryVariables = Record<string, any>;

export abstract class BaseMemory {
  abstract loadMemoryVariables(values: InputValues): Promise<MemoryVariables>;

  abstract saveContext(
    inputValues: InputValues,
    outputValues: OutputValues
  ): Promise<void>;
}

export const getInputValue = (inputValues: InputValues, inputKey?: string) => {
  if (inputKey !== undefined) {
    return inputValues[inputKey];
  }
  const keys = Object.keys(inputValues);
  if (keys.length === 1) {
    return inputValues[keys[0]];
  }
  throw new Error(
    `input values have multiple keys, memory only supported when one key currently: ${keys}`
  );
};

export function getBufferString(
  messages: BaseChatMessage[],
  human_prefix = "Human",
  ai_prefix = "AI"
): string {
  const string_messages: string[] = [];
  for (const m of messages) {
    let role: string;
    if (m._getType() === "human") {
      role = human_prefix;
    } else if (m._getType() === "ai") {
      role = ai_prefix;
    } else if (m._getType() === "system") {
      role = "System";
    } else if (m._getType() === "generic") {
      role = (m as ChatMessage).role;
    } else {
      throw new Error(`Got unsupported message type: ${m}`);
    }
    string_messages.push(`${role}: ${m.text}`);
  }
  return string_messages.join("\n");
}
