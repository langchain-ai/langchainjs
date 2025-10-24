import {
  Container,
  CosmosClient,
  CosmosClientOptions,
  ErrorResponse,
} from "@azure/cosmos";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

const USER_AGENT_SUFFIX = "langchainjs-cdbnosql-chathistory-javascript";
const DEFAULT_DATABASE_NAME = "chatHistoryDB";
const DEFAULT_CONTAINER_NAME = "chatHistoryContainer";

/**
 * Lightweight type for listing chat sessions.
 */
export type ChatSession = {
  id: string;
  context: Record<string, unknown>;
};

/**
 * Type for the input to the `AzureCosmosDBNoSQLChatMessageHistory` constructor.
 */
export interface AzureCosmosDBNoSQLChatMessageHistoryInput {
  sessionId: string;
  userId?: string;
  client?: CosmosClient;
  connectionString?: string;
  endpoint?: string;
  databaseName?: string;
  containerName?: string;
  credentials?: TokenCredential;
  ttl?: number;
}

/**
 * Class for storing chat message history with Cosmos DB NoSQL. It extends the
 * BaseListChatMessageHistory class and provides methods to get, add, and
 * clear messages.
 *
 * @example
 * ```typescript
 *  const model = new ChatOpenAI({
 *   model: "gpt-3.5-turbo",
 *   temperature: 0,
 * });
 * const prompt = ChatPromptTemplate.fromMessages([
 *   [
 *     "system",
 *     "You are a helpful assistant. Answer all questions to the best of your ability.",
 *   ],
 *   new MessagesPlaceholder("chat_history"),
 *   ["human", "{input}"],
 * ]);
 *
 * const chain = prompt.pipe(model).pipe(new StringOutputParser());
 * const chainWithHistory = new RunnableWithMessageHistory({
 *   runnable: chain,
 *  inputMessagesKey: "input",
 *  historyMessagesKey: "chat_history",
 *   getMessageHistory: async (sessionId) => {
 *     const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
 *       sessionId: sessionId,
 *       userId: "user-id",
 *       databaseName: "DATABASE_NAME",
 *       containerName: "CONTAINER_NAME",
 *     })
 *     return chatHistory;
 *   },
 * });
 * await chainWithHistory.invoke(
 *   { input: "What did I just say my name was?" },
 *   { configurable: { sessionId: "session-id" } }
 * );
 * ```
 */
export class AzureCosmsosDBNoSQLChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "azurecosmosdb"];

  private container: Container;

  private sessionId: string;

  private databaseName: string;

  private containerName: string;

  private client: CosmosClient;

  private userId: string;

  private ttl: number | undefined;

  private messageList: BaseMessage[] = [];

  private initPromise?: Promise<void>;

  private context: Record<string, unknown> = {};

  constructor(chatHistoryInput: AzureCosmosDBNoSQLChatMessageHistoryInput) {
    super();

    this.sessionId = chatHistoryInput.sessionId;
    this.databaseName = chatHistoryInput.databaseName ?? DEFAULT_DATABASE_NAME;
    this.containerName =
      chatHistoryInput.containerName ?? DEFAULT_CONTAINER_NAME;
    this.userId = chatHistoryInput.userId ?? "anonymous";
    this.ttl = chatHistoryInput.ttl;
    this.client = this.initializeClient(chatHistoryInput);
  }

  private initializeClient(
    input: AzureCosmosDBNoSQLChatMessageHistoryInput
  ): CosmosClient {
    const connectionString =
      input.connectionString ??
      getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_CONNECTION_STRING");
    const endpoint =
      input.endpoint ?? getEnvironmentVariable("AZURE_COSMOSDB_NOSQL_ENDPOINT");

    if (!input.client && !connectionString && !endpoint) {
      throw new Error(
        "CosmosClient, connection string, or endpoint must be provided."
      );
    }

    if (input.client) {
      return input.client;
    }

    if (connectionString) {
      const [endpointPart, keyPart] = connectionString.split(";");
      const endpoint = endpointPart.split("=")[1];
      const key = keyPart.split("=")[1];

      return new CosmosClient({
        endpoint,
        key,
        userAgentSuffix: USER_AGENT_SUFFIX,
      });
    } else {
      return new CosmosClient({
        endpoint,
        aadCredentials: input.credentials ?? new DefaultAzureCredential(),
        userAgentSuffix: USER_AGENT_SUFFIX,
      } as CosmosClientOptions);
    }
  }

  private async initializeContainer(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const { database } = await this.client.databases.createIfNotExists({
          id: this.databaseName,
        });
        const { container } = await database.containers.createIfNotExists({
          id: this.containerName,
          partitionKey: "/userId",
          defaultTtl: this.ttl,
        });
        this.container = container;
      })().catch((error) => {
        console.error("Error initializing Cosmos DB container:", error);
        throw error;
      });
    }
    return this.initPromise;
  }

  async getMessages(): Promise<BaseMessage[]> {
    await this.initializeContainer();
    const document = await this.container
      .item(this.sessionId, this.userId)
      .read();
    const messages = document.resource?.messages || [];
    this.messageList = mapStoredMessagesToChatMessages(messages);
    return this.messageList;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.initializeContainer();
    this.messageList = await this.getMessages();
    this.messageList.push(message);
    const messages = mapChatMessagesToStoredMessages(this.messageList);
    const context = await this.getContext();
    await this.container.items.upsert({
      id: this.sessionId,
      userId: this.userId,
      context,
      messages,
    });
  }

  async clear(): Promise<void> {
    this.messageList = [];
    await this.initializeContainer();
    await this.container.item(this.sessionId, this.userId).delete();
  }

  async clearAllSessions() {
    await this.initializeContainer();
    const query = {
      query: "SELECT c.id FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: this.userId }],
    };
    const { resources: userSessions } = await this.container.items
      .query(query)
      .fetchAll();
    for (const userSession of userSessions) {
      await this.container.item(userSession.id, this.userId).delete();
    }
  }

  async getAllSessions(): Promise<ChatSession[]> {
    await this.initializeContainer();
    const query = {
      query: "SELECT c.id, c.context FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: this.userId }],
    };
    const { resources: userSessions } = await this.container.items
      .query(query)
      .fetchAll();
    return userSessions ?? [];
  }

  async getContext(): Promise<Record<string, unknown>> {
    await this.initializeContainer();
    const document = await this.container
      .item(this.sessionId, this.userId)
      .read();
    this.context = document.resource?.context || this.context;
    return this.context;
  }

  async setContext(context: Record<string, unknown>): Promise<void> {
    await this.initializeContainer();
    this.context = context || {};
    try {
      await this.container
        .item(this.sessionId, this.userId)
        .patch([{ op: "replace", path: "/context", value: this.context }]);
    } catch (_error: unknown) {
      const error = _error as ErrorResponse;
      // If document does not exist yet, context will be set when adding the first message
      if (error?.code !== 404) {
        throw error;
      }
    }
  }
}
