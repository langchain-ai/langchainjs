import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  StoredMessage,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import PostgresEngine from "./engine.js";

export interface PostgresChatMessageHistoryInput {
  engine: PostgresEngine;
  sessionId: string;
  tableName: string;
  schemaName: string;
}

export class PostgresChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace: string[] = [
    "langchain",
    "stores",
    "message",
    "google-cloud-sql-pg",
  ];

  engine: PostgresEngine;

  sessionId: string;

  tableName: string;

  schemaName: string;

  constructor({
    engine,
    sessionId,
    tableName,
    schemaName = "public",
  }: PostgresChatMessageHistoryInput) {
    super();
    this.engine = engine;
    this.sessionId = sessionId;
    this.tableName = tableName;
    this.schemaName = schemaName;
  }

  /**
   * Create a new PostgresChatMessageHistory instance.
   *
   * @param {PostgresEngine} engine Postgres engine instance to use.
   * @param {string} sessionId Retrieve the table content with this session ID.
   * @param {string} tableName Table name that stores that chat message history. Parameter is not escaped. Do not use with end user input.
   * @param {string} schemaName Schema name for the chat message history table. Default: "public". Parameter is not escaped. Do not use with end user input.
   * @returns PostgresChatMessageHistory instance.
   */
  static async initialize(
    engine: PostgresEngine,
    sessionId: string,
    tableName: string,
    schemaName: string = "public"
  ) {
    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :tableName AND table_schema = :schemaName`;
    const { rows } = await engine.pool.raw(query, { tableName, schemaName });
    const columnNames: string[] = [];

    for (const index in rows) {
      if (Object.prototype.hasOwnProperty.call(rows, index)) {
        columnNames.push(rows[index].column_name);
      }
    }

    const requiredColumns = ["id", "session_id", "data", "type"];

    if (!requiredColumns.every((x) => columnNames.includes(x))) {
      throw new Error(
        `Table '${schemaName}'.'${tableName}' has incorrect schema.
        Got column names ${columnNames} but required column names ${requiredColumns}.
        Please create table with following schema: CREATE TABLE '${schemaName}'.'${tableName}' (
            id SERIAL AUTO_INCREMENT PRIMARY KEY,
            session_id TEXT NOT NULL,
            data JSONB NOT NULL,
            type TEXT NOT NULL
        );
      `
      );
    }

    return new PostgresChatMessageHistory({
      engine,
      sessionId,
      tableName,
      schemaName,
    });
  }

  addUserMessage(message: string): Promise<void> {
    return this.addMessage(new HumanMessage(message));
  }

  addAIChatMessage(message: string): Promise<void> {
    return this.addMessage(new AIMessage(message));
  }

  /**
   * Returns a list of messages stored in the store.
   */
  async getMessages(): Promise<BaseMessage[]> {
    const query = `SELECT data, type FROM "${this.schemaName}"."${this.tableName}" WHERE session_id = :session_id ORDER BY id;`;
    const values: { [key: string]: string } = {
      session_id: this.sessionId,
    };
    const items: StoredMessage[] = [];
    const { rows } = await this.engine.pool.raw(query, values);

    if (rows.length === 0) {
      return [];
    }

    for (const row of rows) {
      items.push({
        data: row.data.data,
        type: row.type,
      });
    }

    return mapStoredMessagesToChatMessages(items);
  }

  /**
   * Add a message object to the store.
   * @param {BaseMessage} message Message to be added to the store
   */
  async addMessage(message: BaseMessage): Promise<void> {
    const query = `INSERT INTO "${this.schemaName}"."${this.tableName}"("session_id", "data", "type") VALUES (:session_id, :data, :type)`;
    const values: { [key: string]: string } = {
      session_id: this.sessionId,
      data: JSON.stringify(message.toDict()),
      type: message.getType(),
    };

    await this.engine.pool.raw(query, values);
  }

  /**
   * Add a list of messages object to the store.
   * @param {Array<BaseMessage>} messages List of messages to be added to the store
   */
  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const msg of messages) {
      await this.addMessage(msg);
    }
  }

  /**
   * Remove all messages from the store.
   */
  async clear(): Promise<void> {
    const query = `DELETE FROM "${this.schemaName}"."${this.tableName}" WHERE session_id = :session_id;`;
    const values: { [key: string]: string } = {
      session_id: this.sessionId,
    };

    await this.engine.pool.raw(query, values);
  }
}
