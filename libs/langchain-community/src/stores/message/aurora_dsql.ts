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
 * AuroraDsqlChatMessageHistory object.
 */
export type AuroraDsqlChatMessageHistoryInput = {
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
   * AuroraDsqlChatMessageHistory object will create a new pool using
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
  /**
   * If true, the table name will be escaped. ('lAnGcHaIn' will be escaped to '"lAnGcHaIn"')
   */
  escapeTableName?: boolean;
};

export interface StoredAuroraDsqlMessageData {
  name: string | undefined;
  role: string | undefined;
  content: string;
  additional_kwargs?: Record<string, unknown>;
  type: string;
  tool_call_id: string | undefined;
}

/**
 * Class for managing chat message history using a Amazon Aurora DSQL Database as a
 * storage backend. Extends the BaseListChatMessageHistory class.
 * @example
 * ```typescript
 * const chatHistory = new AuroraDsqlChatMessageHistory({
 *    tableName: "langchain_chat_histories",
 *    sessionId: "lc-example",
 *    pool: new pg.Pool({
 *      host: "your_dsql_endpoint",
 *      port: 5432,
 *      user: "admin",
 *      password: "your_token",
 *      database: "postgres",
 *      ssl: true
 *    }),
 * });
 * ```
 */
export class AuroraDsqlChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "aurora_dsql"];

  pool: pg.Pool;

  tableName = "langchain_chat_histories";

  sessionId: string;

  private initialized = false;

  /**
   * Creates a new AuroraDsqlChatMessageHistory.
   * @param {AuroraDsqlChatMessageHistoryInput} fields The input fields for the AuroraDsqlChatMessageHistory.
   * @param {string} fields.tableName The name of the table name to use. Defaults to `langchain_chat_histories`.
   * @param {string} fields.sessionId The session ID to use when storing and retrieving chat message history.
   * @param {pg.Pool} fields.pool The Postgres pool to use. If provided, the AuroraDsqlChatMessageHistory will use the provided pool.
   * @param {pg.PoolConfig} fields.poolConfig The configuration object for the Postgres pool. If no pool is provided, the config will be used to create a new pool.
   * If `pool` is provided, it will be used as the Postgres pool even if `poolConfig` is also provided.
   * @throws If neither `pool` nor `poolConfig` is provided.
   */
  constructor(fields: AuroraDsqlChatMessageHistoryInput) {
    super(fields);
    const { tableName, sessionId, pool, poolConfig, escapeTableName } = fields;
    // Ensure that either a client or config is provided
    if (!pool && !poolConfig) {
      throw new Error(
        "AuroraDsqlChatMessageHistory requires either a pool instance or pool config"
      );
    }
    this.pool = pool ?? new pg.Pool(poolConfig);
    const _tableName = tableName || this.tableName;
    this.tableName = escapeTableName
      ? pg.escapeIdentifier(_tableName)
      : _tableName;
    this.sessionId = sessionId;
  }

  /**
   * Checks if the table has been created and creates it if it hasn't.
   * @returns Promise that resolves when the table's existence is ensured.
   */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    const query = `
    CREATE TABLE IF NOT EXISTS ${this.tableName} (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamp default current_timestamp,
      session_id VARCHAR(255) NOT NULL,
      message TEXT NOT NULL
    );`;

    try {
      await this.pool.query(query);
      await this.createIndex();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      // This error indicates that the table already exists
      // Due to asynchronous nature of the code, it is possible that
      // the table is created between the time we check if it exists
      // and the time we try to create it. It can be safely ignored.
      // If it's not this error, rethrow it.
      if (!("code" in e) || e.code !== "23505") {
        throw e;
      }
    }
    this.initialized = true;
  }

  private async createIndex() {
    const query = `CREATE INDEX ASYNC IF NOT EXISTS idx_on_session_id on ${this.tableName} (session_id);`;
    await this.pool.query(query);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();

    const map = mapChatMessagesToStoredMessages([message])[0];

    const query = `INSERT INTO ${this.tableName} (session_id, message) VALUES ($1, $2)`;

    await this.pool.query(query, [
      this.sessionId,
      JSON.stringify({ ...map?.data, type: map?.type }),
    ]);
  }

  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();

    const query = `SELECT message FROM ${this.tableName} WHERE session_id = $1 ORDER BY created_at asc`;

    const res = await this.pool.query(query, [this.sessionId]);

    const storedMessages: StoredMessage[] = res.rows.map(
      (row: { message: string }) => {
        const { type, ...data } = JSON.parse(
          row.message
        ) as StoredAuroraDsqlMessageData;
        return { type, data };
      }
    );
    return mapStoredMessagesToChatMessages(storedMessages);
  }

  async clear(): Promise<void> {
    await this.ensureTable();

    const query = `DELETE FROM ${this.tableName} WHERE session_id = $1`;
    await this.pool.query(query, [this.sessionId]);
  }

  /**
   * End the Postgres pool.
   */
  async end(): Promise<void> {
    await this.pool.end();
  }
}
