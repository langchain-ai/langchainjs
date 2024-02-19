import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import { AstraDB } from "@datastax/astra-db-ts";
import { Collection } from "@datastax/astra-db-ts/dist/collections";

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

export class AstraDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "astradb"];

  private sessionId: string;

  private collection: Collection;

  constructor({ collection, sessionId }: AstraDBChatMessageHistoryProps) {
    super();
    this.sessionId = sessionId;
    this.collection = collection;
  }

  static async initialize({ token, endpoint, collectionName, namespace, sessionId }: AstraDBChatMessageHistoryInput): Promise<AstraDBChatMessageHistory> {
    const client = new AstraDB(token, endpoint, namespace);
    const collection = await client.collection(collectionName);
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