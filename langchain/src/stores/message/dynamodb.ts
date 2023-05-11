import {
  DynamoDBClient,
  DynamoDBClientConfig,
  GetItemCommand,
  GetItemCommandInput,
  UpdateItemCommand,
  UpdateItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  AttributeValue,
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
  partitionKey?: string;
  sortKey?: string;
  messageAttributeName?: string;
  config?: DynamoDBClientConfig;
}

interface DynamoDBSerializedChatMessage {
  M: {
    type: {
      S: string;
    };
    text: {
      S: string;
    };
    role?: {
      S: string;
    };
  };
}

export class DynamoDBChatMessageHistory extends BaseListChatMessageHistory {
  private tableName: string;

  private sessionId: string;

  private client: DynamoDBClient;

  private partitionKey = "id";

  private sortKey?: string;

  private messageAttributeName = "messages";

  private dynamoKey: Record<string, AttributeValue>;

  constructor({
    tableName,
    sessionId,
    partitionKey,
    sortKey,
    messageAttributeName,
    config,
  }: DynamoDBChatMessageHistoryFields) {
    super();
    this.tableName = tableName;
    this.sessionId = sessionId;
    this.client = new DynamoDBClient(config ?? {});
    this.partitionKey = partitionKey ?? this.partitionKey;
    this.sortKey = sortKey;
    this.messageAttributeName =
      messageAttributeName ?? this.messageAttributeName;

    this.dynamoKey = {};
    this.dynamoKey[this.partitionKey] = { S: this.sessionId };
    if (this.sortKey) {
      this.dynamoKey[this.sortKey] = { S: this.sortKey };
    }
  }

  async getMessages(): Promise<BaseChatMessage[]> {
    const params: GetItemCommandInput = {
      TableName: this.tableName,
      Key: this.dynamoKey,
    };

    const response = await this.client.send(new GetItemCommand(params));
    const items = response.Item
      ? response.Item[this.messageAttributeName]?.L ?? []
      : [];
    const messages = items
      .map((item) => ({
        type: item.M?.type.S,
        data: {
          role: item.M?.role?.S,
          content: item.M?.text.S,
        },
      }))
      .filter(
        (x): x is StoredMessage =>
          x.type !== undefined && x.data.content !== undefined
      );
    return mapStoredMessagesToChatMessages(messages);
  }

  async clear(): Promise<void> {
    const params: DeleteItemCommandInput = {
      TableName: this.tableName,
      Key: this.dynamoKey,
    };
    await this.client.send(new DeleteItemCommand(params));
  }

  protected async addMessage(message: BaseChatMessage) {
    const messages = mapChatMessagesToStoredMessages([message]);

    const params: UpdateItemCommandInput = {
      TableName: this.tableName,
      Key: this.dynamoKey,
      ExpressionAttributeNames: {
        "#m": this.messageAttributeName,
      },
      ExpressionAttributeValues: {
        ":empty_list": {
          L: [],
        },
        ":m": {
          L: messages.map((message) => {
            const dynamoSerializedMessage: DynamoDBSerializedChatMessage = {
              M: {
                type: {
                  S: message.type,
                },
                text: {
                  S: message.data.content,
                },
              },
            };
            if (message.data.role) {
              dynamoSerializedMessage.M.role = { S: message.data.role };
            }
            return dynamoSerializedMessage;
          }),
        },
      },
      UpdateExpression:
        "SET #m = list_append(if_not_exists(#m, :empty_list), :m)",
    };
    await this.client.send(new UpdateItemCommand(params));
  }
}
