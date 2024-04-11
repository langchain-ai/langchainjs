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
    additional_kwargs?: {
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

  /**
   * Transforms a `StoredMessage` into a `DynamoDBSerializedChatMessage`.
   * The `DynamoDBSerializedChatMessage` format is suitable for storing in DynamoDB.
   *
   * @param message - The `StoredMessage` to be transformed.
   * @returns The transformed `DynamoDBSerializedChatMessage`.
   */
  private createDynamoDBSerializedChatMessage(
    message: StoredMessage
  ): DynamoDBSerializedChatMessage {
    const {
      type,
      data: { content, role, additional_kwargs },
    } = message;

    const isAdditionalKwargs =
      additional_kwargs && Object.keys(additional_kwargs).length;

    const dynamoSerializedMessage: DynamoDBSerializedChatMessage = {
      M: {
        type: {
          S: type,
        },
        text: {
          S: content,
        },
        additional_kwargs: isAdditionalKwargs
          ? { S: JSON.stringify(additional_kwargs) }
          : { S: "{}" },
      },
    };

    if (role) {
      dynamoSerializedMessage.M.role = { S: role };
    }

    return dynamoSerializedMessage;
  }

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
    try {
      const params: GetItemCommandInput = {
        TableName: this.tableName,
        Key: this.dynamoKey,
      };

      const response = await this.client.send(new GetItemCommand(params));
      const items = response.Item
        ? response.Item[this.messageAttributeName]?.L ?? []
        : [];
      const messages = items
        .filter(
          (
            item
          ): item is AttributeValue & { M: DynamoDBSerializedChatMessage } =>
            item.M !== undefined
        )
        .map((item) => {
          const data: {
            role?: string;
            content: string | undefined;
            additional_kwargs?: Record<string, unknown>;
          } = {
            role: item.M?.role?.S,
            content: item.M?.text.S,
            additional_kwargs: item.M?.additional_kwargs?.S
              ? JSON.parse(item.M?.additional_kwargs.S)
              : undefined,
          };

          return {
            type: item.M?.type.S,
            data,
          };
        })
        .filter(
          (x): x is StoredMessage =>
            x.type !== undefined && x.data.content !== undefined
        );
      return mapStoredMessagesToChatMessages(messages);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(`Error getting messages: ${error.message}`);
    }
  }

  /**
   * Adds a new message to the DynamoDB table.
   * @param message The message to be added to the DynamoDB table.
   */
  async addMessage(message: BaseMessage) {
    try {
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
            L: messages.map(this.createDynamoDBSerializedChatMessage),
          },
        },
        UpdateExpression:
          "SET #m = list_append(if_not_exists(#m, :empty_list), :m)",
      };
      await this.client.send(new UpdateItemCommand(params));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(`Error adding message: ${error.message}`);
    }
  }

  /**
   * Adds new messages to the DynamoDB table.
   * @param messages The messages to be added to the DynamoDB table.
   */
  async addMessages(messages: BaseMessage[]): Promise<void> {
    try {
      const storedMessages = mapChatMessagesToStoredMessages(messages);
      const dynamoMessages = storedMessages.map(
        this.createDynamoDBSerializedChatMessage
      );

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
            L: dynamoMessages,
          },
        },
        UpdateExpression:
          "SET #m = list_append(if_not_exists(#m, :empty_list), :m)",
      };
      await this.client.send(new UpdateItemCommand(params));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(`Error adding messages: ${error.message}`);
    }
  }

  /**
   * Deletes all messages from the DynamoDB table.
   */
  async clear(): Promise<void> {
    try {
      const params: DeleteItemCommandInput = {
        TableName: this.tableName,
        Key: this.dynamoKey,
      };
      await this.client.send(new DeleteItemCommand(params));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(`Error clearing messages: ${error.message}`);
    }
  }
}
