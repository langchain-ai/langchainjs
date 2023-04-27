import {
  HumanChatMessage,
  AIChatMessage,
  BaseChatMessage,
  BaseChatMessageHistory,
  SystemChatMessage,
  ChatMessage,
} from "../../schema/index.js";

import {
    DynamoDBClient,
    GetItemCommand,
    GetItemCommandInput,
    PutItemCommand,
    PutItemCommandInput
} from "@aws-sdk/client-dynamodb";


export class DynamoDBChatMessageHistory extends BaseChatMessageHistory {
    private tableName: string;
    private sessionId: string;
    private client: DynamoDBClient;

    constructor(tableName: string, sessionId: string) {
        super();
        this.tableName = tableName;
        this.sessionId = sessionId;
        this.client = new DynamoDBClient({});
    }

    async getMessages(): Promise<BaseChatMessage[]> {
        const params: GetItemCommandInput = {
            TableName: this.tableName,
            Key: { id: { S: this.sessionId } },
        }
        const response = await this.client.send(new GetItemCommand(params));
        const items = response.Item?.messages.L ?? [];
        const messages = items.map(item => {
            return {
                type: item.M?.type.S!,
                text: item.M?.text.S!
            }
        });
        return this.messagesFromDict(messages);
    }

    async addUserMessage(message: string): Promise<void> {
        await this.putItem(new HumanChatMessage(message));
    }

    async addAIChatMessage(message: string): Promise<void> {
        await this.putItem(new AIChatMessage(message));
    }

    async clear(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    private async putItem(message: BaseChatMessage) {
        const messages = this.messagesToDict(await this.getMessages());
        messages.push({ type: message._getType(), text: message.text });

        const params: PutItemCommandInput = {
            TableName: this.tableName,
            Item: {
                id: { S: this.sessionId },
                messages: {
                    L: messages.map(x => {
                        return {
                            M: {
                                type: { S: x.type },
                                text: { S: x.text },
                            }
                        };
                    }),
                },
            },
        };
        await new DynamoDBClient({}).send(new PutItemCommand(params));
    }

    private messagesFromDict(messages: { type: string, text: string }[]): BaseChatMessage[] {
        return messages.map(x => {
            switch (x.type) {
                case "human":
                    return new HumanChatMessage(x.text);
                case "ai":
                    return new AIChatMessage(x.text);
                case "system":
                    return new SystemChatMessage(x.text);
                case "chat":
                    return new ChatMessage(x.text, x.type);
                default:
                    throw new Error("Invalid message type: " + x.type);
            }
        });
    }

    private messagesToDict(messages: BaseChatMessage[]): { type: string, text: string }[] {
        return messages.map(x => {
            return {
                type: x._getType(),
                text: x.text,
            };
        });
    }
}
