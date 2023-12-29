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
  public abstract addMessage(message: BaseMessage): Promise<void>;

  public addUserMessage(message: string): Promise<void> {
    return this.addMessage(new HumanMessage(message));
  }

  public addAIChatMessage(message: string): Promise<void> {
    return this.addMessage(new AIMessage(message));
  }

  public abstract getMessages(): Promise<BaseMessage[]>;
}
