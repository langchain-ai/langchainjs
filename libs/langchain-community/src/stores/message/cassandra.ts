import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

import {
  Column,
  CassandraTable,
  CassandraClientArgs,
} from "../../utils/cassandra.js";

export interface CassandraChatMessageHistoryOptions
  extends CassandraClientArgs {
  keyspace: string;
  table: string;
  sessionId: string;
}

/**
 * Class for storing chat message history within Cassandra. It extends the
 * BaseListChatMessageHistory class and provides methods to get, add, and
 * clear messages.
 * @example
 * ```typescript
 * const chatHistory = new CassandraChatMessageHistory({
 *   cloud: {
 *     secureConnectBundle: "<path to your secure bundle>",
 *   },
 *   credentials: {
 *     username: "token",
 *     password: "<your Cassandra access token>",
 *   },
 *   keyspace: "langchain",
 *   table: "message_history",
 *   sessionId: "<some unique session identifier>",
 * });
 *
 * const chain = new ConversationChain({
 *   llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
 *   memory: chatHistory,
 * });
 *
 * const response = await chain.invoke({
 *   input: "What did I just say my name was?",
 * });
 * console.log({ response });
 * ```
 */
export class CassandraChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "cassandra"];

  private cassandraTable: CassandraTable;

  private sessionId: string;

  private options: CassandraChatMessageHistoryOptions;

  private colSessionId: Column;

  private colMessageTs: Column;

  private colMessageType: Column;

  private colData: Column;

  constructor(options: CassandraChatMessageHistoryOptions) {
    super();
    this.sessionId = options.sessionId;
    this.options = options;

    this.colSessionId = { name: "session_id", type: "text", partition: true };
    this.colMessageTs = { name: "message_ts", type: "timestamp" };
    this.colMessageType = { name: "message_type", type: "text" };
    this.colData = { name: "data", type: "text" };
  }

  /**
   * Method to get all the messages stored in the Cassandra database.
   * @returns Array of stored BaseMessage instances.
   */
  public async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();

    const resultSet = await this.cassandraTable.select(
      [this.colMessageType, this.colData],
      [{ name: "session_id", value: this.sessionId }]
    );

    const storedMessages: StoredMessage[] = resultSet.rows.map((row) => ({
      type: row.message_type,
      data: JSON.parse(row.data),
    }));

    const baseMessages = mapStoredMessagesToChatMessages(storedMessages);
    return baseMessages;
  }

  /**
   * Method to add a new message to the Cassandra database.
   * @param message The BaseMessage instance to add.
   * @returns A promise that resolves when the message has been added.
   */
  public async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();
    const messages = mapChatMessagesToStoredMessages([message]);
    const { type, data } = messages[0];

    return this.cassandraTable
      .upsert(
        [[this.sessionId, type, Date.now(), JSON.stringify(data)]],
        [
          this.colSessionId,
          this.colMessageType,
          this.colMessageTs,
          this.colData,
        ]
      )
      .then(() => {});
  }

  /**
   * Method to clear all the messages from the Cassandra database.
   * @returns A promise that resolves when all messages have been cleared.
   */
  public async clear(): Promise<void> {
    await this.ensureTable();
    return this.cassandraTable
      .delete({ name: this.colSessionId.name, value: this.sessionId })
      .then(() => {});
  }

  /**
   * Method to initialize the Cassandra database.
   * @returns Promise that resolves when the database has been initialized.
   */
  private async ensureTable(): Promise<void> {
    if (this.cassandraTable) {
      return;
    }

    const tableConfig = {
      ...this.options,
      primaryKey: [this.colSessionId, this.colMessageTs],
      nonKeyColumns: [this.colMessageType, this.colData],
    };

    this.cassandraTable = await new CassandraTable(tableConfig);
  }
}
