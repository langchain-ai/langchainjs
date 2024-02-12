import { Serializable } from "./load/serializable.js";
import { type BaseMessage, HumanMessage, AIMessage } from "./messages/index.js";

/**
 * Base class for all chat message histories. All chat message histories
 * should extend this class.
 */
export abstract class BaseChatMessageHistory extends Serializable {
  public abstract getMessages(): Promise<BaseMessage[]>;

  public abstract addMessage(message: BaseMessage): Promise<void>;

  public abstract addUserMessage(message: string): Promise<void>;

  public abstract addAIChatMessage(message: string): Promise<void>;

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
