import {
  BaseClient,
  BaseClientOptions,
  GetTableSchemaResponse,
  Schemas,
  XataApiClient,
  parseWorkspacesUrlParts,
} from "@xata.io/client";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  StoredMessageData,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/**
 * An object type that represents the input for the XataChatMessageHistory
 * class.
 */
export type XataChatMessageHistoryInput<XataClient> = {
  sessionId: string;
  config?: BaseClientOptions;
  client?: XataClient;
  table?: string;
  createTable?: boolean;
  apiKey?: string;
};

/**
 * An interface that represents the data transfer object for stored
 * messages.
 */
interface storedMessagesDTO {
  id: string;
  sessionId: string;
  type: string;
  content: string;
  role?: string;
  name?: string;
  additionalKwargs: string;
}

const chatMemoryColumns: Schemas.Column[] = [
  { name: "sessionId", type: "string" },
  { name: "type", type: "string" },
  { name: "role", type: "string" },
  { name: "content", type: "text" },
  { name: "name", type: "string" },
  { name: "additionalKwargs", type: "text" },
];

/**
 * A class for managing chat message history using Xata.io client. It
 * extends the BaseListChatMessageHistory class and provides methods to
 * get, add, and clear messages. It also ensures the existence of a table
 * where the chat messages are stored.
 * @example
 * ```typescript
 * const chatHistory = new XataChatMessageHistory({
 *   table: "messages",
 *   sessionId: new Date().toISOString(),
 *   client: new BaseClient({
 *     databaseURL: process.env.XATA_DB_URL,
 *     apiKey: process.env.XATA_API_KEY,
 *     branch: "main",
 *   }),
 *   apiKey: process.env.XATA_API_KEY,
 * });
 *
 * const chain = new ConversationChain({
 *   llm: new ChatOpenAI(),
 *   memory: new BufferMemory({ chatHistory }),
 * });
 *
 * const response = await chain.invoke({
 *   input: "What did I just say my name was?",
 * });
 * console.log({ response });
 * ```
 */
export class XataChatMessageHistory<
  XataClient extends BaseClient
> extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "xata"];

  public client: XataClient;

  private sessionId: string;

  private table: string;

  private tableInitialized: boolean;

  private createTable: boolean;

  private apiClient: XataApiClient;

  constructor(fields: XataChatMessageHistoryInput<XataClient>) {
    super(fields);

    const { sessionId, config, client, table } = fields;
    this.sessionId = sessionId;
    this.table = table || "memory";
    if (client) {
      this.client = client;
    } else if (config) {
      this.client = new BaseClient(config) as XataClient;
    } else {
      throw new Error(
        "Either a client or a config must be provided to XataChatMessageHistoryInput"
      );
    }
    if (fields.createTable !== false) {
      this.createTable = true;
      const apiKey = fields.apiKey || fields.config?.apiKey;
      if (!apiKey) {
        throw new Error(
          "If createTable is set, an apiKey must be provided to XataChatMessageHistoryInput, either directly or through the config object"
        );
      }
      this.apiClient = new XataApiClient({ apiKey });
    } else {
      this.createTable = false;
    }
    this.tableInitialized = false;
  }

  /**
   * Retrieves all messages associated with the session ID, ordered by
   * creation time.
   * @returns A promise that resolves to an array of BaseMessage instances.
   */
  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();
    const records = await this.client.db[this.table]
      .filter({ sessionId: this.sessionId })
      .sort("xata.createdAt", "asc")
      .getAll();

    const rawStoredMessages = records as unknown as storedMessagesDTO[];
    const orderedMessages: StoredMessage[] = rawStoredMessages.map(
      (message: storedMessagesDTO) => {
        const data = {
          content: message.content,
          additional_kwargs: JSON.parse(message.additionalKwargs),
        } as StoredMessageData;
        if (message.role) {
          data.role = message.role;
        }
        if (message.name) {
          data.name = message.name;
        }

        return {
          type: message.type,
          data,
        };
      }
    );
    return mapStoredMessagesToChatMessages(orderedMessages);
  }

  /**
   * Adds a new message to the database.
   * @param message The BaseMessage instance to be added.
   * @returns A promise that resolves when the message has been added.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();
    const messageToAdd = mapChatMessagesToStoredMessages([message]);
    await this.client.db[this.table].create({
      sessionId: this.sessionId,
      type: messageToAdd[0].type,
      content: messageToAdd[0].data.content,
      role: messageToAdd[0].data.role,
      name: messageToAdd[0].data.name,
      additionalKwargs: JSON.stringify(messageToAdd[0].data.additional_kwargs),
    });
  }

  /**
   * Deletes all messages associated with the session ID.
   * @returns A promise that resolves when the messages have been deleted.
   */
  async clear(): Promise<void> {
    await this.ensureTable();
    const records = await this.client.db[this.table]
      .select(["id"])
      .filter({ sessionId: this.sessionId })
      .getAll();
    const ids = records.map((m) => m.id);
    await this.client.db[this.table].delete(ids);
  }

  /**
   * Checks if the table exists and creates it if it doesn't. This method is
   * called before any operation on the table.
   * @returns A promise that resolves when the table has been ensured.
   */
  private async ensureTable(): Promise<void> {
    if (!this.createTable) {
      return;
    }
    if (this.tableInitialized) {
      return;
    }

    const { databaseURL, branch } = await this.client.getConfig();
    const [, , host, , database] = databaseURL.split("/");
    const urlParts = parseWorkspacesUrlParts(host);
    if (urlParts == null) {
      throw new Error("Invalid databaseURL");
    }
    const { workspace, region } = urlParts;
    const tableParams = {
      workspace,
      region,
      database,
      branch,
      table: this.table,
    };

    let schema: GetTableSchemaResponse | null = null;
    try {
      schema = await this.apiClient.tables.getTableSchema(tableParams);
    } catch (e) {
      // pass
    }
    if (schema == null) {
      await this.apiClient.tables.createTable(tableParams);
      await this.apiClient.tables.setTableSchema({
        ...tableParams,
        schema: {
          columns: chatMemoryColumns,
        },
      });
    }
  }
}
