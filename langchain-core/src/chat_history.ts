import { Serializable } from "./load/serializable.js";
import { type BaseMessage, HumanMessage, AIMessage } from "./messages/index.js";

// TODO: Combine into one class for 0.2

/**
 * Base class for all chat message histories. All chat message histories
 * should extend this class.
 */
export abstract class BaseChatMessageHistory extends Serializable {
  public abstract getMessages(): Promise<BaseMessage[]>;

  public abstract addMessage(message: BaseMessage): Promise<void>;

  public abstract addUserMessage(message: string): Promise<void>;

  public abstract addAIChatMessage(message: string): Promise<void>;

  /**
   * Add a list of messages.
   *
   * Implementations should override this method to handle bulk addition of messages
   * in an efficient manner to avoid unnecessary round-trips to the underlying store.
   *
   * @param messages - A list of BaseMessage objects to store.
   */
  public async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  public abstract clear(): Promise<void>;
}

/**
 * Base class for all list chat message histories. All list chat message
 * histories should extend this class.
 */
export abstract class BaseListChatMessageHistory extends Serializable {
  /** Returns a list of messages stored in the store. */
  public abstract getMessages(): Promise<BaseMessage[]>;

  /**
   * Add a message object to the store.
   */
  public abstract addMessage(message: BaseMessage): Promise<void>;

  /**
   * This is a convenience method for adding a human message string to the store.
   * Please note that this is a convenience method. Code should favor the
   * bulk addMessages interface instead to save on round-trips to the underlying
   * persistence layer.
   * This method may be deprecated in a future release.
   */
  public addUserMessage(message: string): Promise<void> {
    return this.addMessage(new HumanMessage(message));
  }

  /** @deprecated Use addAIMessage instead */
  public addAIChatMessage(message: string): Promise<void> {
    return this.addMessage(new AIMessage(message));
  }

  /**
   * This is a convenience method for adding an AI message string to the store.
   * Please note that this is a convenience method. Code should favor the bulk
   * addMessages interface instead to save on round-trips to the underlying
   * persistence layer.
   * This method may be deprecated in a future release.
   */
  public addAIMessage(message: string): Promise<void> {
    return this.addMessage(new AIMessage(message));
  }

  /**
   * Add a list of messages.
   *
   * Implementations should override this method to handle bulk addition of messages
   * in an efficient manner to avoid unnecessary round-trips to the underlying store.
   *
   * @param messages - A list of BaseMessage objects to store.
   */
  public async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  /**
   * Remove all messages from the store.
   */
  public clear(): Promise<void> {
    throw new Error("Not implemented.");
  }
}

/**
 * Class for storing chat message history in-memory. It extends the
 * BaseListChatMessageHistory class and provides methods to get, add, and
 * clear messages.
 */
export class InMemoryChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "in_memory"];

  private messages: BaseMessage[] = [];

  constructor(messages?: BaseMessage[]) {
    super(...arguments);
    this.messages = messages ?? [];
  }

  /**
   * Method to get all the messages stored in the ChatMessageHistory
   * instance.
   * @returns Array of stored BaseMessage instances.
   */
  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  /**
   * Method to add a new message to the ChatMessageHistory instance.
   * @param message The BaseMessage instance to add.
   * @returns A promise that resolves when the message has been added.
   */
  async addMessage(message: BaseMessage) {
    this.messages.push(message);
  }

  /**
   * Method to clear all the messages from the ChatMessageHistory instance.
   * @returns A promise that resolves when all messages have been cleared.
   */
  async clear() {
    this.messages = [];
  }
}
