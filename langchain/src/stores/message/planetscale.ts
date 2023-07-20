import {
  Client as PlanetscaleClient,
  Config as PlanetscaleConfig,
  Connection as PlanetscaleConnection,
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

export type PlanetscaleChatMessageHistoryInput = {
  collectionName?: string;
  sessionId: string;
  config?: PlanetscaleConfig;
  client?: PlanetscaleClient;
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

export class PlanetscaleChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "planetscale"];

  get lc_secrets() {
    return {
      "config.host": "PLANETSCALE_HOST",
      "config.username": "PLANETSCALE_USERNAME",
      "config.password": "PLANETSCALE_PASSWORD",
      "config.url": "PLANETSCALE_DATABASE_URL",
    };
  }

  public client: PlanetscaleClient;

  private connection: PlanetscaleConnection;

  private collectionName: string;

  private sessionId: string;

  constructor(fields: PlanetscaleChatMessageHistoryInput) {
    super(fields);

    const { sessionId, config, client, collectionName } = fields;

    if (client) {
      this.client = client;
    } else if (config) {
      this.client = new PlanetscaleClient(config);
    } else {
      throw new Error(
        "Either a client or config must be provided to PlanetscaleChatMessageHistory"
      );
    }

    this.connection = this.client.connection();

    this.collectionName = collectionName || "stored_message";
    this.sessionId = sessionId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const query =
      "SELECT * FROM :collection_name WHERE session_id = :session_id";
    const params = {
      collection_name: this.collectionName,
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
    const messageToAdd = mapChatMessagesToStoredMessages([message]);

    const query =
      "INSERT INTO :collection_name (session_id, type, content, role, name, additional_kwargs) VALUES (:session_id, :type, :content, :role, :name, :additional_kwargs)";

    const params = {
      collection_name: this.collectionName,
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
    const query = "DELETE FROM :collection_name WHERE session_id = :session_id";
    const params = {
      collection_name: this.collectionName,
      session_id: this.sessionId,
    };
    await this.connection.execute(query, params);
  }
}
