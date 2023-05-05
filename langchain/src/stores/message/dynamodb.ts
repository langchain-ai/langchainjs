import {
  DynamoDBClient,
  DynamoDBClientConfig,
  GetItemCommand,
  GetItemCommandInput,
  PutItemCommand,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";

import {
  BaseChatMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";
import {
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export interface DynamoDBChatMessageHistoryFields {
  tableName: string;
  sessionId: string;
  config?: DynamoDBClientConfig;
}

export class DynamoDBChatMessageHistory extends BaseListChatMessageHistory {
  private tableName: string;

  private sessionId: string;

  private client: DynamoDBClient;

  constructor({
    tableName,
    sessionId,
    config,
  }: DynamoDBChatMessageHistoryFields) {
    super();
    this.tableName = tableName;
    this.sessionId = sessionId;
    this.client = new DynamoDBClient(config ?? {});
  }

  async getMessages(): Promise<BaseChatMessage[]> {
    const params: GetItemCommandInput = {
      TableName: this.tableName,
      Key: { id: { S: this.sessionId } },
    };
    const response = await this.client.send(new GetItemCommand(params));
    const items = response.Item?.messages.L ?? [];
    const messages = items
      .map((item) => ({
        type: item.M?.type.S,
        role: item.M?.role.S,
        text: item.M?.text.S,
      }))
      .filter(
        (x): x is StoredMessage => x.type !== undefined && x.text !== undefined
      );
    return mapStoredMessagesToChatMessages(messages);
  }

  async clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  protected async addMessage(message: BaseChatMessage) {
    const currentMessages = await this.getMessages();
    const messages = mapChatMessagesToStoredMessages([
      ...currentMessages,
      message,
    ]);

    const params: PutItemCommandInput = {
      TableName: this.tableName,
      Item: {
        id: { S: this.sessionId },
        messages: {
          L: messages.map((x) => ({
            M: {
              type: { S: x.type },
              text: { S: x.text },
            },
          })),
        },
      },
    };
    await new DynamoDBClient({}).send(new PutItemCommand(params));
  }
}
