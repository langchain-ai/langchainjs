import { v4 } from "uuid";
import type { D1Database } from "@cloudflare/workers-types";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  StoredMessageData,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
/**
 * Type definition for the input parameters required when instantiating a
 * CloudflareD1MessageHistory object.
 */
export type CloudflareD1MessageHistoryInput = {
  tableName?: string;
  sessionId: string;
  database?: D1Database;
};

/**
 * Interface for the data transfer object used when selecting stored
 * messages from the Cloudflare D1 database.
 */
interface selectStoredMessagesDTO {
  id: string;
  session_id: string;
  type: string;
  content: string;
  role: string | null;
  name: string | null;
  additional_kwargs: string;
}

/**
 * Class for storing and retrieving chat message history from a
 * Cloudflare D1 database. Extends the BaseListChatMessageHistory class.
 * @example
 * ```typescript
 * const memory = new BufferMemory({
 *   returnMessages: true,
 *   chatHistory: new CloudflareD1MessageHistory({
 *     tableName: "stored_message",
 *     sessionId: "example",
 *     database: env.DB,
 *   }),
 * });
 *
 * const chainInput = { input };
 *
 * const res = await memory.chatHistory.invoke(chainInput);
 * await memory.saveContext(chainInput, {
 *   output: res,
 * });
 * ```
 */
export class CloudflareD1MessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "cloudflare_d1"];

  public database: D1Database;

  private tableName: string;

  private sessionId: string;

  private tableInitialized: boolean;

  constructor(fields: CloudflareD1MessageHistoryInput) {
    super(fields);

    const { sessionId, database, tableName } = fields;

    if (database) {
      this.database = database;
    } else {
      throw new Error(
        "Either a client or config must be provided to CloudflareD1MessageHistory"
      );
    }

    this.tableName = tableName || "langchain_chat_histories";
    this.tableInitialized = false;
    this.sessionId = sessionId;
  }

  /**
   * Private method to ensure that the necessary table exists in the
   * Cloudflare D1 database before performing any operations. If the table
   * does not exist, it is created.
   * @returns Promise that resolves to void.
   */
  private async ensureTable(): Promise<void> {
    if (this.tableInitialized) {
      return;
    }

    const query = `CREATE TABLE IF NOT EXISTS ${this.tableName} (id TEXT PRIMARY KEY, session_id TEXT, type TEXT, content TEXT, role TEXT, name TEXT, additional_kwargs TEXT);`;
    await this.database.prepare(query).bind().all();

    const idIndexQuery = `CREATE INDEX IF NOT EXISTS id_index ON ${this.tableName} (id);`;
    await this.database.prepare(idIndexQuery).bind().all();

    const sessionIdIndexQuery = `CREATE INDEX IF NOT EXISTS session_id_index ON ${this.tableName} (session_id);`;
    await this.database.prepare(sessionIdIndexQuery).bind().all();

    this.tableInitialized = true;
  }

  /**
   * Method to retrieve all messages from the Cloudflare D1 database for the
   * current session.
   * @returns Promise that resolves to an array of BaseMessage objects.
   */
  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();

    const query = `SELECT * FROM ${this.tableName} WHERE session_id = ?`;
    const rawStoredMessages = await this.database
      .prepare(query)
      .bind(this.sessionId)
      .all();
    const storedMessagesObject =
      rawStoredMessages.results as unknown as selectStoredMessagesDTO[];

    const orderedMessages: StoredMessage[] = storedMessagesObject.map(
      (message) => {
        const data = {
          content: message.content,
          additional_kwargs: JSON.parse(message.additional_kwargs),
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
   * Method to add a new message to the Cloudflare D1 database for the current
   * session.
   * @param message The BaseMessage object to be added to the database.
   * @returns Promise that resolves to void.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();

    const messageToAdd = mapChatMessagesToStoredMessages([message]);

    const query = `INSERT INTO ${this.tableName} (id, session_id, type, content, role, name, additional_kwargs) VALUES(?, ?, ?, ?, ?, ?, ?)`;

    const id = v4();

    await this.database
      .prepare(query)
      .bind(
        id,
        this.sessionId,
        messageToAdd[0].type || null,
        messageToAdd[0].data.content || null,
        messageToAdd[0].data.role || null,
        messageToAdd[0].data.name || null,
        JSON.stringify(messageToAdd[0].data.additional_kwargs)
      )
      .all();
  }

  /**
   * Method to delete all messages from the Cloudflare D1 database for the
   * current session.
   * @returns Promise that resolves to void.
   */
  async clear(): Promise<void> {
    await this.ensureTable();

    const query = `DELETE FROM ? WHERE session_id = ? `;
    await this.database
      .prepare(query)
      .bind(this.tableName, this.sessionId)
      .all();
  }
}
