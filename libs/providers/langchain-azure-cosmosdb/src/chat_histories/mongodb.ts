import {
  Collection,
  Document as AzureCosmosMongoDBDocument,
  PushOperator,
  Db,
  MongoClient,
} from "mongodb";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

export interface AzureCosmosDBMongoChatHistoryDBConfig {
  readonly client?: MongoClient;
  readonly connectionString?: string;
  readonly databaseName?: string;
  readonly collectionName?: string;
}

export type ChatSessionMongo = {
  id: string;
  context: Record<string, unknown>;
};

const ID_KEY = "sessionId";
const ID_USER = "userId";

export class AzureCosmosDBMongoChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "azurecosmosdb"];

  get lc_secrets(): { [key: string]: string } {
    return {
      connectionString: "AZURE_COSMOSDB_MONGODB_CONNECTION_STRING",
    };
  }

  private initPromise?: Promise<void>;

  private context: Record<string, unknown> = {};

  private readonly client: MongoClient | undefined;

  private database: Db;

  private collection: Collection<AzureCosmosMongoDBDocument>;

  private sessionId: string;

  private userId: string;

  initialize: () => Promise<void>;

  constructor(
    dbConfig: AzureCosmosDBMongoChatHistoryDBConfig,
    sessionId: string,
    userId: string
  ) {
    super();

    const connectionString =
      dbConfig.connectionString ??
      getEnvironmentVariable("AZURE_COSMOSDB_MONGODB_CONNECTION_STRING");

    if (!dbConfig.client && !connectionString) {
      throw new Error("Mongo client or connection string must be set.");
    }

    if (!dbConfig.client) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.client = new MongoClient(connectionString!, {
        appName: "langchainjs",
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const client = dbConfig.client || this.client!;
    const databaseName = dbConfig.databaseName ?? "chatHistoryDB";
    const collectionName = dbConfig.collectionName ?? "chatHistory";

    this.sessionId = sessionId;
    this.userId = userId ?? "anonymous";

    // Deferring initialization to the first call to `initialize`
    this.initialize = () => {
      if (this.initPromise === undefined) {
        this.initPromise = this.init(
          client,
          databaseName,
          collectionName
        ).catch((error) => {
          console.error(
            "Error during AzureCosmosDBMongoChatMessageHistory initialization: ",
            error
          );
        });
      }

      return this.initPromise;
    };
  }

  /**
   * Initializes the AzureCosmosDBMongoChatMessageHistory by connecting to the database.
   * @param client The MongoClient to use for connecting to the database.
   * @param databaseName The name of the database to use.
   * @param collectionName The name of the collection to use.
   * @returns A promise that resolves when the AzureCosmosDBMongoChatMessageHistory has been initialized.
   */
  private async init(
    client: MongoClient,
    databaseName: string,
    collectionName: string
  ): Promise<void> {
    this.initPromise = (async () => {
      await client.connect();
      this.database = client.db(databaseName);
      this.collection = this.database.collection(collectionName);
    })();

    return this.initPromise;
  }

  /**
   * Retrieves the messages stored in the history.
   * @returns A promise that resolves with the messages stored in the history.
   */
  async getMessages(): Promise<BaseMessage[]> {
    await this.initialize();

    const document = await this.collection.findOne({
      [ID_KEY]: this.sessionId,
      [ID_USER]: this.userId,
    });
    const messages = document?.messages || [];
    return mapStoredMessagesToChatMessages(messages);
  }

  /**
   * Adds a message to the history.
   * @param message The message to add to the history.
   * @returns A promise that resolves when the message has been added to the history.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    await this.initialize();

    const messages = mapChatMessagesToStoredMessages([message]);
    const context = await this.getContext();
    await this.collection.updateOne(
      { [ID_KEY]: this.sessionId, [ID_USER]: this.userId },
      {
        $push: { messages: { $each: messages } } as PushOperator<Document>,
        $set: { context },
      },
      { upsert: true }
    );
  }

  /**
   * Clear the history.
   * @returns A promise that resolves when the history has been cleared.
   */
  async clear(): Promise<void> {
    await this.initialize();

    await this.collection.deleteOne({
      [ID_KEY]: this.sessionId,
      [ID_USER]: this.userId,
    });
  }

  async getAllSessions(): Promise<ChatSessionMongo[]> {
    await this.initialize();
    const documents = await this.collection
      .find({
        [ID_USER]: this.userId,
      })
      .toArray();

    const chatSessions: ChatSessionMongo[] = documents.map((doc) => ({
      id: doc[ID_KEY],
      user_id: doc[ID_USER],
      context: doc.context || {},
    }));

    return chatSessions;
  }

  async clearAllSessions() {
    await this.initialize();
    try {
      await this.collection.deleteMany({
        [ID_USER]: this.userId,
      });
    } catch (error) {
      console.error("Error clearing chat history sessions:", error);
      throw error;
    }
  }

  async getContext(): Promise<Record<string, unknown>> {
    await this.initialize();

    const document = await this.collection.findOne({
      [ID_KEY]: this.sessionId,
      [ID_USER]: this.userId,
    });
    this.context = document?.context || this.context;
    return this.context;
  }

  async setContext(context: Record<string, unknown>): Promise<void> {
    await this.initialize();

    try {
      await this.collection.updateOne(
        { [ID_KEY]: this.sessionId },
        {
          $set: { context },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error("Error setting chat history context", error);
      throw error;
    }
  }
}
