import { Zep, ZepClient } from "@getzep/zep-cloud";
import { Memory, NotFoundError, RoleType } from "@getzep/zep-cloud/api";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  MessageType,
} from "@langchain/core/messages";
import { condenseZepMemoryIntoHumanMessage } from "../../memory/zep_cloud.js";

export const getZepMessageRoleType = (role: MessageType): RoleType => {
  switch (role) {
    case "human":
      return "user";
    case "ai":
      return "assistant";
    case "system":
      return "system";
    case "function":
      return "function";
    case "tool":
      return "tool";
    default:
      return "norole";
  }
};

/**
 * Interface defining the structure of the input data for the ZepMemory
 * class. It includes properties like humanPrefix, aiPrefix, memoryKey, sessionId, memoryType and apiKey.
 */
interface ZepMemoryInput {
  sessionId: string;
  client: ZepClient;
  memoryType: Zep.MemoryGetRequestMemoryType;
  humanPrefix?: string;
  aiPrefix?: string;
}

/**
 * Class used to manage the memory of a chat session, including loading
 * and saving the chat history, and clearing the memory when needed. It
 * uses the ZepClient to interact with the Zep service for managing the
 * chat session's memory.
 *
 */
export class ZepCloudChatMessageHistory
  extends BaseChatMessageHistory
  implements ZepMemoryInput
{
  lc_namespace: string[] = [];

  sessionId: string;

  client: ZepClient;

  memoryType: Zep.MemoryGetRequestMemoryType;

  humanPrefix = "human";

  aiPrefix = "ai";

  constructor(fields: ZepMemoryInput) {
    super();
    this.sessionId = fields.sessionId;
    this.memoryType = fields.memoryType;
    this.client = fields.client;
    if (fields.humanPrefix) {
      this.humanPrefix = fields.humanPrefix;
    }
    if (fields.aiPrefix) {
      this.aiPrefix = fields.aiPrefix;
    }
  }

  private async getMemory(): Promise<Memory | null> {
    try {
      return this.client.memory.get(this.sessionId, {
        memoryType: this.memoryType,
      });
    } catch (error) {
      // eslint-disable-next-line no-instanceof/no-instanceof
      if (error instanceof NotFoundError) {
        console.warn(
          `Session ${this.sessionId} not found in Zep. Returning None`
        );
      } else {
        console.error("Error getting memory: ", error);
      }
      return null;
    }
  }

  async getMessages(): Promise<BaseMessage[]> {
    const memory = await this.getMemory();
    if (!memory) {
      return [];
    }

    return [condenseZepMemoryIntoHumanMessage(memory)];
  }

  async addAIChatMessage(
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.addMessage(new AIMessage({ content: message }), metadata);
  }

  async addMessage(
    message: BaseMessage,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const messageToSave = message;
    if (message._getType() === "ai") {
      messageToSave.name = this.aiPrefix;
    } else if (message._getType() === "human") {
      messageToSave.name = this.humanPrefix;
    }
    if (message.content === null) {
      throw new Error("Message content cannot be null");
    }

    if (Array.isArray(message.content)) {
      throw new Error("Message content cannot be a list");
    }

    await this.client.memory.add(this.sessionId, {
      messages: [
        {
          content: message.content,
          role: message.name ?? message._getType(),
          roleType: getZepMessageRoleType(message._getType()),
          metadata,
        },
      ],
    });
  }

  async addUserMessage(
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.addMessage(new HumanMessage({ content: message }, metadata));
  }

  clear(): Promise<void> {
    console.warn("Clearing memory", this.sessionId);
    return Promise.resolve(undefined);
  }
}
