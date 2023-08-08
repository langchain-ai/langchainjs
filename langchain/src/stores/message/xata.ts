import { BaseClient, BaseClientOptions } from "@xata.io/client";
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

export type XataChatMessageHistoryInput<XataClient> = {
  sessionId: string;
  config?: BaseClientOptions;
  client?: XataClient;
  table?: string;
};

interface storedMessagesDTO {
  id: string;
  sessionId: string;
  type: string;
  content: string;
  role?: string;
  name?: string;
  additionalKwargs: string;
}

export class XataChatMessageHistory<
  XataClient extends BaseClient
> extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "xata"];

  public client: XataClient;

  private sessionId: string;

  private table: string;

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
  }

  async getMessages(): Promise<BaseMessage[]> {
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

  async addMessage(message: BaseMessage): Promise<void> {
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

  async clear(): Promise<void> {
    const records = await this.client.db[this.table]
      .select(["id"])
      .filter({ sessionId: this.sessionId })
      .getAll();
    const ids = records.map((m) => m.id);
    await this.client.db[this.table].delete(ids);
  }
}
