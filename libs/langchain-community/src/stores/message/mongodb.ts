import {
  Collection,
  Document as MongoDBDocument,
  ObjectId,
  UpdateFilter,
} from "mongodb";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  type StoredMessage,
  type BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/** @deprecated Install and import from the "@langchain/mongodb" integration package instead. */
export interface MongoDBChatMessageHistoryInput {
  collection: Collection<MongoDBDocument>;
  sessionId: string;
}

/**
 * @deprecated Install and import from the "@langchain/mongodb" integration package instead.
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
      } as unknown as UpdateFilter<ChatHistoryDocument>,
      { upsert: true }
    );
  }

  async clear(): Promise<void> {
    await this.collection.deleteOne({ _id: new ObjectId(this.sessionId) });
  }
}

interface ChatHistoryDocument extends MongoDBDocument {
  messages: StoredMessage[];
}
