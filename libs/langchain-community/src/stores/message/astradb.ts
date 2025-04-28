import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import { DataAPIClient, Collection } from "@datastax/astra-db-ts";

export interface AstraDBChatMessageHistoryInput {
  token: string;
  endpoint: string;
  collectionName: string;
  namespace?: string;
  sessionId: string;
}

export interface AstraDBChatMessageHistoryProps {
  collection: Collection;
  sessionId: string;
}

/**
 * Class for storing chat message history with Astra DB. It extends the
 * BaseListChatMessageHistory class and provides methods to get, add, and
 * clear messages.
 * @example
 *
 * ```typescript
 * const client = new AstraDB(
 *   process.env.ASTRA_DB_APPLICATION_TOKEN,
 *   process.env.ASTRA_DB_ENDPOINT,
 *   process.env.ASTRA_DB_NAMESPACE
 * );
 *
 * const collection = await client.collection("test_chat");
 *
 * const chatHistory = new AstraDBChatMessageHistory({
 *   collection,
 *   sessionId: "YOUR_SESSION_ID",
 * });
 *
 * const messages = await chatHistory.getMessages();
 *
 * await chatHistory.clear();
 */
export class AstraDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "astradb"];

  private sessionId: string;

  private collection: Collection;

  constructor({ collection, sessionId }: AstraDBChatMessageHistoryProps) {
    super();
    this.sessionId = sessionId;
    this.collection = collection;
  }

  /**
   * async initializer function to return a new instance of AstraDBChatMessageHistory in a single step
   * @param AstraDBChatMessageHistoryInput
   * @returns Promise<AstraDBChatMessageHistory>
   *
   * @example
   * const chatHistory = await AstraDBChatMessageHistory.initialize({
   *  token: process.env.ASTRA_DB_APPLICATION_TOKEN,
   *  endpoint: process.env.ASTRA_DB_ENDPOINT,
   *  namespace: process.env.ASTRA_DB_NAMESPACE,
   *  collectionName:"test_chat",
   *  sessionId: "YOUR_SESSION_ID"
   * });
   */
  static async initialize({
    token,
    endpoint,
    collectionName,
    namespace,
    sessionId,
  }: AstraDBChatMessageHistoryInput): Promise<AstraDBChatMessageHistory> {
    const client = new DataAPIClient(token, { caller: ["langchainjs"] });
    const db = client.db(endpoint, { namespace });
    const collection = await db.collection(collectionName);
    return new AstraDBChatMessageHistory({ collection, sessionId });
  }

  async getMessages(): Promise<BaseMessage[]> {
    const docs = this.collection.find({
      sessionId: this.sessionId,
    });

    const docsArray = await docs.toArray();

    const sortedDocs = docsArray.sort((a, b) => a.timestamp - b.timestamp);

    const storedMessages: StoredMessage[] = sortedDocs.map((doc) => ({
      type: doc.type,
      data: doc.data,
    }));

    return mapStoredMessagesToChatMessages(storedMessages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const messages = mapChatMessagesToStoredMessages([message]);
    const { type, data } = messages[0];

    await this.collection.insertOne({
      sessionId: this.sessionId,
      timestamp: Date.now(),
      type,
      data,
    });
  }

  async clear(): Promise<void> {
    await this.collection.deleteMany({
      sessionId: this.sessionId,
    });
  }
}
