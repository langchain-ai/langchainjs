import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  type BaseMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import * as cborg from "cborg";
import { type Datastore, Key } from "interface-datastore";
import all from "it-all";

export interface IPFSDatastoreChatMessageHistoryInput {
  sessionId: string;
}

export interface IPFSDatastoreChatMessageHistoryProps {
  datastore: Datastore;
  sessionId: string;
}

export class IPFSDatastoreChatMessageHistory extends BaseListChatMessageHistory {
  readonly lc_namespace = ["langchain", "stores", "message", "datastore"];

  readonly sessionId: string;

  private readonly datastore: Datastore;

  constructor({ datastore, sessionId }: IPFSDatastoreChatMessageHistoryProps) {
    super({ sessionId });

    this.datastore = datastore;
    this.sessionId = sessionId;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const data = await all(
      this.datastore.query({ prefix: `/${this.sessionId}` })
    );
    const messages = data.map((d) => cborg.decode(d.value));

    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.addMessages([message]);
  }

  async addMessages(messages: BaseMessage[]): Promise<void> {
    const { length } = await all(
      this.datastore.queryKeys({ prefix: `/${this.sessionId}` })
    );
    const serializedMessages = mapChatMessagesToStoredMessages(messages);

    const pairs = serializedMessages.map((message, index) => ({
      key: new Key(`/${this.sessionId}/${index + length}`),
      value: cborg.encode(message),
    }));

    await all(this.datastore.putMany(pairs));
  }

  async clear(): Promise<void> {
    const keys = this.datastore.queryKeys({ prefix: `/${this.sessionId}` });

    await all(this.datastore.deleteMany(keys));
  }
}
