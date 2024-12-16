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

const ID_KEY = "sessionId";

export class AzureCosmosDBMongoChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "azurecosmosdb"];

  get lc_secrets(): { [key: string]: string } {
    return {
      connectionString: "AZURE_COSMOSDB_MONGODB_CONNECTION_STRING",
    };
  }

  private initPromise?: Promise<void>;

  private readonly client: MongoClient | undefined;

  private database: Db;

  private collection: Collection<AzureCosmosMongoDBDocument>;

  private sessionId: string;

  initialize: () => Promise<void>;

  constructor(
    dbConfig: AzureCosmosDBMongoChatHistoryDBConfig,
    sessionId: string
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
    await this.collection.updateOne(
      { [ID_KEY]: this.sessionId },
      {
        $push: { messages: { $each: messages } } as PushOperator<Document>,
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

    await this.collection.deleteOne({ [ID_KEY]: this.sessionId });
  }
}
