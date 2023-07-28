import {
  Client as PlanetScaleClient,
  Config as PlanetScaleConfig,
  Connection as PlanetScaleConnection,
} from "@planetscale/database";
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

export type PlanetScaleChatMessageHistoryInput = {
  tableName?: string;
  sessionId: string;
  config?: PlanetScaleConfig;
  client?: PlanetScaleClient;
};

interface selectStoredMessagesDTO {
  id: string;
  session_id: string;
  type: string;
  content: string;
  role: string | null;
  name: string | null;
  additional_kwargs: string;
}

export class PlanetScaleChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "planetscale"];

  get lc_secrets() {
    return {
      "config.host": "PLANETSCALE_HOST",
      "config.username": "PLANETSCALE_USERNAME",
      "config.password": "PLANETSCALE_PASSWORD",
      "config.url": "PLANETSCALE_DATABASE_URL",
    };
  }

  public client: PlanetScaleClient;

  private connection: PlanetScaleConnection;

  private tableName: string;

  private sessionId: string;

  private tableInitialized: boolean;

  constructor(fields: PlanetScaleChatMessageHistoryInput) {
    super(fields);

    const { sessionId, config, client, tableName } = fields;

    if (client) {
      this.client = client;
    } else if (config) {
      this.client = new PlanetScaleClient(config);
    } else {
      throw new Error(
        "Either a client or config must be provided to PlanetScaleChatMessageHistory"
      );
    }

    this.connection = this.client.connection();

    this.tableName = tableName || "langchain_chat_histories";
    this.tableInitialized = false;
    this.sessionId = sessionId;
  }

  private async ensureTable(): Promise<void> {
    if (this.tableInitialized) {
      return;
    }

    const query = `CREATE TABLE IF NOT EXISTS ${this.tableName} (id BINARY(16) PRIMARY KEY, session_id VARCHAR(255), type VARCHAR(255), content VARCHAR(255), role VARCHAR(255), name VARCHAR(255), additional_kwargs VARCHAR(255));`;

    await this.connection.execute(query);

    const indexQuery = `ALTER TABLE ${this.tableName} MODIFY id BINARY(16) DEFAULT (UUID_TO_BIN(UUID()));`;

    await this.connection.execute(indexQuery);

    this.tableInitialized = true;
  }

  async getMessages(): Promise<BaseMessage[]> {
    await this.ensureTable();

    const query = `SELECT * FROM ${this.tableName} WHERE session_id = :session_id`;
    const params = {
      session_id: this.sessionId,
    };

    const rawStoredMessages = await this.connection.execute(query, params);
    const storedMessagesObject =
      rawStoredMessages.rows as unknown as selectStoredMessagesDTO[];

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

  async addMessage(message: BaseMessage): Promise<void> {
    await this.ensureTable();

    const messageToAdd = mapChatMessagesToStoredMessages([message]);

    const query = `INSERT INTO ${this.tableName} (session_id, type, content, role, name, additional_kwargs) VALUES (:session_id, :type, :content, :role, :name, :additional_kwargs)`;

    const params = {
      session_id: this.sessionId,
      type: messageToAdd[0].type,
      content: messageToAdd[0].data.content,
      role: messageToAdd[0].data.role,
      name: messageToAdd[0].data.name,
      additional_kwargs: JSON.stringify(messageToAdd[0].data.additional_kwargs),
    };

    await this.connection.execute(query, params);
  }

  async clear(): Promise<void> {
    await this.ensureTable();

    const query = `DELETE FROM ${this.tableName} WHERE session_id = :session_id`;
    const params = {
      session_id: this.sessionId,
    };
    await this.connection.execute(query, params);
  }
}
