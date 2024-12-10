import {
  Collection,
  Document as AzureCosmosMongoDBDocument,
  PushOperator,
} from "mongodb";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

export interface AzureCosmosDBMongoChatMessageHistoryInput {
  collection: Collection<AzureCosmosMongoDBDocument>;
  sessionId: string;
}

export class AzureCosmosDBMongoChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "azurecosmosdb"];

  private collection: Collection<AzureCosmosMongoDBDocument>;

  private sessionId: string;

  private idKey = "sessionId";

  constructor({
    collection,
    sessionId,
  }: AzureCosmosDBMongoChatMessageHistoryInput) {
    super();
    this.collection = collection;
    this.sessionId = sessionId;
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
        $push: { messages: { $each: messages } } as PushOperator<Document>,
      },
      { upsert: true }
    );
  }

  async clear(): Promise<void> {
    await this.collection.deleteOne({ [this.idKey]: this.sessionId });
  }
}
