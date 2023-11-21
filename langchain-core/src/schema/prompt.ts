import { Serializable } from "../load/serializable.js";
import type { BaseMessage } from "./messages.js";

/**
 * Base PromptValue class. All prompt values should extend this class.
 */
export abstract class BasePromptValue extends Serializable {
  abstract toString(): string;

  abstract toChatMessages(): BaseMessage[];
}
