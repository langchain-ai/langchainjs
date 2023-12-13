import { Serializable } from "./load/serializable.js";
import {
  type BaseMessage,
  HumanMessage,
  getBufferString,
} from "./messages/index.js";

/**
 * Base PromptValue class. All prompt values should extend this class.
 */
export abstract class BasePromptValue extends Serializable {
  abstract toString(): string;

  abstract toChatMessages(): BaseMessage[];
}

/**
 * Represents a prompt value as a string. It extends the BasePromptValue
 * class and overrides the toString and toChatMessages methods.
 */
export class StringPromptValue extends BasePromptValue {
  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  value: string;

  constructor(value: string) {
    super({ value });
    this.value = value;
  }

  toString() {
    return this.value;
  }

  toChatMessages() {
    return [new HumanMessage(this.value)];
  }
}

/**
 * Interface for the fields of a ChatPromptValue.
 */
export interface ChatPromptValueFields {
  messages: BaseMessage[];
}

/**
 * Class that represents a chat prompt value. It extends the
 * BasePromptValue and includes an array of BaseMessage instances.
 */
export class ChatPromptValue extends BasePromptValue {
  lc_namespace = ["langchain_core", "prompt_values"];

  lc_serializable = true;

  static lc_name() {
    return "ChatPromptValue";
  }

  messages: BaseMessage[];

  constructor(messages: BaseMessage[]);

  constructor(fields: ChatPromptValueFields);

  constructor(fields: BaseMessage[] | ChatPromptValueFields) {
    if (Array.isArray(fields)) {
      // eslint-disable-next-line no-param-reassign
      fields = { messages: fields };
    }

    super(fields);
    this.messages = fields.messages;
  }

  toString() {
    return getBufferString(this.messages);
  }

  toChatMessages() {
    return this.messages;
  }
}
