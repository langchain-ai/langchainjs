import type { D1Database } from "@cloudflare/workers-types";

import {
  BaseMessage,
  BaseListChatMessageHistory,
  StoredMessage,
  StoredMessageData,
} from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

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
 * messages from the PlanetScale database.
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
 * PlanetScale database. Extends the BaseListChatMessageHistory class.
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
   * PlanetScale database before performing any operations. If the table
   * does not exist, it is created.
   * @returns Promise that resolves to void.
   */
  private async ensureTable(): Promise<void> {
    if (this.tableInitialized) {
      return;
    }

    const query = `CREATE TABLE IF NOT EXISTS ? (id BINARY(16) PRIMARY KEY, session_id VARCHAR(255), type VARCHAR(255), content VARCHAR(255), role VARCHAR(255), name VARCHAR(255), additional_kwargs VARCHAR(255));`;

    await this.database.prepare(query).bind(this.tableName).all();

    const indexQuery = `ALTER TABLE ? MODIFY id BINARY(16) DEFAULT (UUID_TO_BIN(UUID()));`;

    await this.database.prepare(indexQuery).bind(this.tableName).all();

    this.tableInitialized = true;
  }

  /**
   * Method to retrieve all messages from the PlanetScale database for the
   * current session.
   * @returns Promise that resolves to an array of BaseMessage objects.
   */
  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();

    const query = `SELECT * FROM ? WHERE session_id = ?`;
    const rawStoredMessages = await this.database.prepare(query).bind(this.tableName, this.sessionId).all()
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
   * Method to add a new message to the PlanetScale database for the current
   * session.
   * @param message The BaseMessage object to be added to the database.
   * @returns Promise that resolves to void.
   */
  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();

    const messageToAdd = mapChatMessagesToStoredMessages([message]);

    const query = `INSERT INTO ${this.tableName} (session_id, type, content, role, name, additional_kwargs) VALUES (?, ?, ?, ?, ?, ?)`;

    await this.database.prepare(query).bind(
      this.sessionId,
      messageToAdd[0].type,
      messageToAdd[0].data.content,
      messageToAdd[0].data.role,
      messageToAdd[0].data.name,
      JSON.stringify(messageToAdd[0].data.additional_kwargs),
    ).all()
  }

  /**
   * Method to delete all messages from the PlanetScale database for the
   * current session.
   * @returns Promise that resolves to void.
   */
  async clear(): Promise<void> {
    await this.ensureTable();

    const query = `DELETE FROM ? WHERE session_id = ?`;
    await this.database.prepare(query).bind(this.tableName, this.sessionId).all();
  }
}
