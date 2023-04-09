import {
  BaseChatMessage,
  HumanChatMessage,
  AIChatMessage,
  SystemChatMessage,
  ChatMessage,
} from "../schema/index.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InputValues<K extends string> = Record<K, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OutputValues<K extends string> = Record<K, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MemoryVariables<K extends string> = Record<K, any>;

export abstract class BaseMemory<I extends string, O extends string> {
  abstract loadMemoryVariables(
    values: InputValues<I>
  ): Promise<MemoryVariables<I>>;

  abstract saveContext(
    inputValues: InputValues<I>,
    outputValues: OutputValues<O>
  ): Promise<void>;
}

export const getInputValue = <I extends string>(
  inputValues: InputValues<I>,
  inputKey?: I
) => {
  if (inputKey !== undefined) {
    return inputValues[inputKey];
  }
  const keys = Object.keys(inputValues) as I[];
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
    if (m instanceof HumanChatMessage) {
      role = human_prefix;
    } else if (m instanceof AIChatMessage) {
      role = ai_prefix;
    } else if (m instanceof SystemChatMessage) {
      role = "System";
    } else if (m instanceof ChatMessage) {
      role = m.role;
    } else {
      throw new Error(`Got unsupported message type: ${m}`);
    }
    string_messages.push(`${role}: ${m.text}`);
  }
  return string_messages.join("\n");
}
