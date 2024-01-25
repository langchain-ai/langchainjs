import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import pg from "pg";

/**
 * Type definition for the input parameters required when instantiating a
 * PostgresChatMessageHistory object.
 */
export type PostgresChatMessageHistoryInput = {
  /**
   * Name of the table to use when storing and retrieving chat message
   */
  tableName?: string;
  /**
   * Session ID to use when storing and retrieving chat message history.
   */
  sessionId: string;
  /**
   * Configuration object for the Postgres pool. If provided the
   * PostgresChatMessageHistory object will create a new pool using
   * the provided configuration. Otherwise it will use the provided
   * pool.
   */
  poolConfig?: pg.PoolConfig;
  /**
   * Postgres pool to use. If provided the PostgresChatMessageHistory
   * object will use the provided pool. Otherwise it will create a
   * new pool using the provided configuration.
   */
  pool?: pg.Pool;
};

export type StoredPostgresMessageData = {
  name: string;
  role: string;
  content: string;
  additional_kwargs?: Record<string, unknown>;
  type: string;
  tool_call_id: string;
};

export class PostgresChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "postgres"];

  pool: pg.Pool;

  tableName = "langchain_chat_histories";

  sessionId: string;

  private initialized = false;

  constructor(fields: PostgresChatMessageHistoryInput) {
    const { tableName, sessionId, pool: client, poolConfig } = fields;
    super(fields);
    // Ensure that either a client or config is provided
    if (!client && !poolConfig) {
      throw new Error(
        "PostgresChatMessageHistory requires either a client or config"
      );
    } else if (client && poolConfig) {
      throw new Error(
        "PostgresChatMessageHistory requires either a client or config, not both"
      );
    }
    this.pool = client || new pg.Pool(poolConfig);
    this.tableName = tableName || this.tableName;
    this.sessionId = sessionId;
  }

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    const query = `
        CREATE TABLE IF NOT EXISTS "${this.tableName}" (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(255) NOT NULL,
            message JSONB NOT NULL
        );`;
    await this.pool.query(query);
    this.initialized = true;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();
    const storedMessage = mapChatMessagesToStoredMessages([message]).map(
      ({ data, type }) => [this.sessionId, { ...data, type }]
    )[0];

    const query = `INSERT INTO "${this.tableName}" (session_id, message) VALUES ($1, $2)`;

    await this.pool.query(query, storedMessage);
  }

  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();

    const query = `SELECT message FROM "${this.tableName}" WHERE session_id = $1 ORDER BY id`;

    const res = await this.pool.query(query, [this.sessionId]);

    const storedMessages: StoredMessage[] = res.rows.map(
      (row: { message: StoredPostgresMessageData }) => {
        const { type, ...data } = row.message;
        return { type, data };
      }
    );
    return mapStoredMessagesToChatMessages(storedMessages);
  }

  async clear(): Promise<void> {
    await this.ensureTable();

    const query = `DELETE FROM "${this.tableName}" WHERE session_id = $1`;
    await this.pool.query(query, [this.sessionId]);
  }

  /**
   * End the Postgres pool.
   */
  async end(): Promise<void> {
    await this.pool.end();
  }
}
