import neo4j, { Driver, Record, auth } from "neo4j-driver";
import { v4 as uuidv4 } from "uuid";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

export type Neo4jChatMessageHistoryConfigInput = {
  sessionId?: string | number;
  sessionNodeLabel?: string;
  messageNodeLabel?: string;
  url: string;
  username: string;
  password: string;
  windowSize?: number;
};

const defaultConfig = {
  sessionNodeLabel: "ChatSession",
  messageNodeLabel: "ChatMessage",
  windowSize: 3,
};

export class Neo4jChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace: string[] = ["langchain", "stores", "message", "neo4j"];

  sessionId: string | number;

  sessionNodeLabel: string;

  messageNodeLabel: string;

  windowSize: number;

  private driver: Driver;

  constructor({
    sessionId = uuidv4(),
    sessionNodeLabel = defaultConfig.sessionNodeLabel,
    messageNodeLabel = defaultConfig.messageNodeLabel,
    url,
    username,
    password,
    windowSize = defaultConfig.windowSize,
  }: Neo4jChatMessageHistoryConfigInput) {
    super();

    this.sessionId = sessionId;
    this.sessionNodeLabel = sessionNodeLabel;
    this.messageNodeLabel = messageNodeLabel;
    this.windowSize = windowSize;

    if (url && username && password) {
      try {
        this.driver = neo4j.driver(url, auth.basic(username, password));
      } catch (e: any) {
        throw new Error(
          `Could not create a Neo4j driver instance. Please check the connection details.\nCause: ${e.message}`
        );
      }
    } else {
      throw new Error("Neo4j connection details not provided.");
    }
  }

  static async initialize(
    props: Neo4jChatMessageHistoryConfigInput
  ): Promise<Neo4jChatMessageHistory> {
    const instance = new Neo4jChatMessageHistory(props);

    try {
      await instance.verifyConnectivity();
    } catch (e: any) {
      throw new Error(
        `Could not verify connection to the Neo4j database.\nCause: ${e.message}`
      );
    }

    return instance;
  }

  async verifyConnectivity() {
    const connectivity = await this.driver.getServerInfo();
    return connectivity;
  }

  async getMessages(): Promise<BaseMessage[]> {
    const getMessagesCypherQuery = `
      MERGE (chatSession:${this.sessionNodeLabel} {id: $sessionId})
      WITH chatSession
      MATCH (chatSession)-[:LAST_MESSAGE]->(lastMessage)
      MATCH p=(lastMessage)<-[:NEXT*0..${this.windowSize * 2 - 1}]-()
      WITH p, length(p) AS length
      ORDER BY length DESC LIMIT 1
      UNWIND reverse(nodes(p)) AS node
      RETURN {data:{content: node.content}, type:node.type} AS result
    `;

    try {
      const { records } = await this.driver.executeQuery(
        getMessagesCypherQuery,
        {
          sessionId: this.sessionId,
        }
      );
      const results = records.map((record: Record) => record.get("result"));

      return mapStoredMessagesToChatMessages(results);
    } catch (e: any) {
      throw new Error(`Ohno! Couldn't get messages.\nCause: ${e.message}`);
    }
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const addMessageCypherQuery = `
      MERGE (chatSession:${this.sessionNodeLabel} {id: $sessionId})
      WITH chatSession
      OPTIONAL MATCH (chatSession)-[lastMessageRel:LAST_MESSAGE]->(lastMessage)
      CREATE (chatSession)-[:LAST_MESSAGE]->(newLastMessage:${this.messageNodeLabel})
      SET newLastMessage += {type:$type, content:$content}
      WITH newLastMessage, lastMessageRel, lastMessage
      WHERE lastMessage IS NOT NULL
      CREATE (lastMessage)-[:NEXT]->(newLastMessage)
      DELETE lastMessageRel
    `;

    try {
      await this.driver.executeQuery(addMessageCypherQuery, {
        sessionId: this.sessionId,
        type: message.getType(),
        content: message.content,
      });
    } catch (e: any) {
      throw new Error(`Ohno! Couldn't add message.\nCause: ${e.message}`);
    }
  }

  async clear() {
    const clearMessagesCypherQuery = `
      MATCH p=(chatSession:${this.sessionNodeLabel} {id: $sessionId})-[:LAST_MESSAGE]->(lastMessage)<-[:NEXT*0..]-()
      UNWIND nodes(p) as node
      DETACH DELETE node
    `;

    try {
      await this.driver.executeQuery(clearMessagesCypherQuery, {
        sessionId: this.sessionId,
      });
    } catch (e: any) {
      throw new Error(
        `Ohno! Couldn't clear chat history.\nCause: ${e.message}`
      );
    }
  }

  async close() {
    await this.driver.close();
  }
}
