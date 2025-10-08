import {
  Collection,
  Document as MongoDBDocument,
  type PushOperator,
} from "mongodb";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

export interface MongoDBChatMessageHistoryInput {
  collection: Collection<MongoDBDocument>;
  sessionId: string;
}

/**
 * @example
 * ```typescript
 * const chatHistory = new MongoDBChatMessageHistory({
 *   collection: myCollection,
 *   sessionId: 'unique-session-id',
 * });
 * const messages = await chatHistory.getMessages();
 * await chatHistory.clear();
 * ```
 */
export class MongoDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "mongodb"];

  private collection: Collection<MongoDBDocument>;

  private sessionId: string;

  private idKey = "sessionId";

  constructor({ collection, sessionId }: MongoDBChatMessageHistoryInput) {
    super();
    this.collection = collection;
    this.sessionId = sessionId;
    this.collection.db.client.appendMetadata({
      name: "langchainjs_chat_history",
    });
  }

  async getMessages(): Promise<BaseMessage[]> {
    const document = await this.collection.findOne({
      [this.idKey]: this.sessionId,
    });
    const messages = document?.messages || [];
    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const messages = mapChatMessagesToStoredMessages([message]);
    await this.collection.updateOne(
      { [this.idKey]: this.sessionId },
      {
        $push: { messages: { $each: messages } } as PushOperator<{
          messages: StoredMessage[];
        }>,
      },
      { upsert: true }
    );
  }

  async clear(): Promise<void> {
    await this.collection.deleteOne({ [this.idKey]: this.sessionId });
  }
}
