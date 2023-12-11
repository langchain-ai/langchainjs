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

import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/**
 * Interface defining the fields required to create an instance of
 * `DynamoDBChatMessageHistory`. It includes the DynamoDB table name,
 * session ID, partition key, sort key, message attribute name, and
 * DynamoDB client configuration.
 */
export interface DynamoDBChatMessageHistoryFields {
  tableName: string;
  sessionId: string;
  partitionKey?: string;
  sortKey?: string;
  messageAttributeName?: string;
  config?: DynamoDBClientConfig;
  key?: Record<string, AttributeValue>;
}

/**
 * Interface defining the structure of a chat message as it is stored in
 * DynamoDB.
 */
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

/**
 * Class providing methods to interact with a DynamoDB table to store and
 * retrieve chat messages. It extends the `BaseListChatMessageHistory`
 * class.
 */
export class DynamoDBChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "dynamodb"];

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      "config.credentials.accessKeyId": "AWS_ACCESS_KEY_ID",
      "config.credentials.secretAccessKey": "AWS_SECRETE_ACCESS_KEY",
      "config.credentials.sessionToken": "AWS_SESSION_TOKEN",
    };
  }

  private tableName: string;

  private sessionId: string;

  private client: DynamoDBClient;

  private partitionKey = "id";

  private sortKey?: string;

  private messageAttributeName = "messages";

  private dynamoKey: Record<string, AttributeValue> = {};

  constructor({
    tableName,
    sessionId,
    partitionKey,
    sortKey,
    messageAttributeName,
    config,
    key = {},
  }: DynamoDBChatMessageHistoryFields) {
    super();

    this.tableName = tableName;
    this.sessionId = sessionId;
    this.client = new DynamoDBClient(config ?? {});
    this.partitionKey = partitionKey ?? this.partitionKey;
    this.sortKey = sortKey;
    this.messageAttributeName =
      messageAttributeName ?? this.messageAttributeName;
    this.dynamoKey = key;

    // override dynamoKey with partition key and sort key when key not specified
    if (Object.keys(this.dynamoKey).length === 0) {
      this.dynamoKey[this.partitionKey] = { S: this.sessionId };
      if (this.sortKey) {
        this.dynamoKey[this.sortKey] = { S: this.sortKey };
      }
    }
  }

  /**
   * Retrieves all messages from the DynamoDB table and returns them as an
   * array of `BaseMessage` instances.
   * @returns Array of stored messages
   */
  async getMessages(): Promise<BaseMessage[]> {
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

  /**
   * Deletes all messages from the DynamoDB table.
   */
  async clear(): Promise<void> {
    const params: DeleteItemCommandInput = {
      TableName: this.tableName,
      Key: this.dynamoKey,
    };
    await this.client.send(new DeleteItemCommand(params));
  }

  /**
   * Adds a new message to the DynamoDB table.
   * @param message The message to be added to the DynamoDB table.
   */
  async addMessage(message: BaseMessage) {
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
