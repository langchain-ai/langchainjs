import { Collection, Document as MongoDBDocument, ObjectId } from "mongodb";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
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

  constructor({ collection, sessionId }: MongoDBChatMessageHistoryInput) {
    super();
    this.collection = collection;
    this.sessionId = sessionId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const document = await this.collection.findOne({
      _id: new ObjectId(this.sessionId),
    });
    const messages = document?.messages || [];
    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const messages = mapChatMessagesToStoredMessages([message]);
    await this.collection.updateOne(
      { _id: new ObjectId(this.sessionId) },
      {
        $push: { messages: { $each: messages } },
      },
      { upsert: true }
    );
  }

  async clear(): Promise<void> {
    await this.collection.deleteOne({ _id: new ObjectId(this.sessionId) });
  }
}
