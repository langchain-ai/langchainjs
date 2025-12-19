import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  RemoveMessage,
} from "@langchain/core/messages";

import { ZkStash } from "@zkstash/sdk/rest";
import { ZkStashRetriever } from "./retrievers.js";

/**
 * Interface for the fields required during the initialization of a
 * `ZkStashMemoryMiddleware`.
 */
export interface ZkStashMemoryMiddlewareFields {
  /**
   * Existing zkStash client.
   */
  client?: ZkStash;
  /**
   * API Key for zkStash. If provided, client will be created automatically.
   */
  apiKey?: string;
  /**
   * Base URL for the zkStash API.
   * @default "https://api.zkstash.ai"
   */
  baseUrl?: string;
  /**
   * Schemas to use for automated extraction during afterModel.
   */
  schemas: string[];
  /**
   * Default filters for retrieval. `agentId` is required.
   */
  filters: {
    agentId: string;
    threadId?: string;
  };
  /**
   * Optional retriever instance. If not provided, one will be created.
   */
  retriever?: ZkStashRetriever;
  /**
   * Whether to perform dynamic semantic retrieval on every turn.
   * If false, context is only retrieved once at the start of the session.
   * @default true
   */
  dynamic?: boolean;
  /**
   * Number of recent messages to include in the semantic search query.
   * Increasing this helps with "Contextual Retrieval" when the last message is short.
   * @default 1
   */
  searchContextWindow?: number;
}

const MIDDLEWARE_BRAND = Symbol.for("AgentMiddleware");
const CONTEXT_MESSAGE_ID = "zkstash-context";

/**
 * zkStash Memory Middleware.
 */
export class ZkStashMemoryMiddleware {
  [MIDDLEWARE_BRAND] = true as const;

  name = "ZkStashMemoryMiddleware";

  private client: ZkStash;
  private schemas: string[];
  private filters: ZkStashMemoryMiddlewareFields["filters"];
  private retriever: ZkStashRetriever;
  private dynamic: boolean;
  private searchContextWindow: number;

  constructor(fields: ZkStashMemoryMiddlewareFields) {
    this.schemas = fields.schemas;
    this.filters = fields.filters;
    this.dynamic = fields.dynamic ?? true;
    this.searchContextWindow = fields.searchContextWindow ?? 1;

    if (fields.client) {
      this.client = fields.client;
    } else if (fields.apiKey) {
      this.client = new ZkStash({ apiKey: fields.apiKey, baseUrl: fields.baseUrl });
    } else {
      throw new Error("Either client or apiKey must be provided to ZkStashMemoryMiddleware.");
    }

    this.retriever = fields.retriever ?? new ZkStashRetriever({
      client: this.client,
      filters: {
        agentId: this.filters.agentId,
        threadId: this.filters.threadId,
        kind: this.schemas.length === 1 ? this.schemas[0] : undefined,
      },
      mode: "raw",
    });
  }

  /**
   * Injects relevant long-term memory into the current context window.
   */
  async beforeModel(state: { messages: BaseMessage[] }) {
    const lastMessage = state.messages.at(-1);
    
    // 1. Guard for turn-based retrieval
    if (!HumanMessage.isInstance(lastMessage)) {
      return;
    }

    // 2. Guard for 'Static' mode
    const hasExistingContext = state.messages.some(m => m.id === CONTEXT_MESSAGE_ID);
    if (!this.dynamic && hasExistingContext) {
      return;
    }

    // 3. Construct Contextual Query
    // We concatenate the last N messages to provide enough semantic depth for the search.
    const queryMessages = state.messages
      .filter(m => HumanMessage.isInstance(m) || AIMessage.isInstance(m))
      .slice(-this.searchContextWindow);
    
    const query = queryMessages
      .map(m => {
        const role = HumanMessage.isInstance(m) ? "User" : "Assistant";
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return `${role}: ${content}`;
      })
      .join("\n");

    if (!query.trim()) {
      return;
    }

    // 4. Perform semantic retrieval
    const docs = await this.retriever.invoke(query);
    if (docs.length === 0) {
      return;
    }

    const context = docs.map((doc) => {
      const kind = doc.metadata.kind ? `[${doc.metadata.kind}] ` : "";
      return `${kind}${doc.pageContent}`;
    }).join("\n");

    /**
     * Context Message Construction:
     * - We use HumanMessage for broad provider compatibility.
     * - We use a fixed ID to allow deduplication/replacement.
     */
    const memoryMessageContext = new HumanMessage({
      id: CONTEXT_MESSAGE_ID,
      content: `Relevant memories for current context:\n\n<memories>${context}</memories>`,
      additional_kwargs: { source: "zkstash" }
    });

    const resultMessages: BaseMessage[] = [];
    if (hasExistingContext) {
      resultMessages.push(new RemoveMessage({ id: CONTEXT_MESSAGE_ID }));
    }
    resultMessages.push(memoryMessageContext);

    return {
      messages: resultMessages
    };
  }

  /**
   * Triggers automated extraction of new knowledge into the Shared Brain.
   */
  async afterModel(state: { messages: BaseMessage[] }) {
    const messages = state.messages;
    if (messages.length < 2) return;

    const lastMessage = messages.at(-1);
    const prevMessage = messages.at(-2);

    if (!AIMessage.isInstance(lastMessage) || !HumanMessage.isInstance(prevMessage)) {
      return;
    }

    const userContent = typeof prevMessage.content === "string" ? prevMessage.content : "";
    const assistantContent = typeof lastMessage.content === "string" ? lastMessage.content : "";

    if (!userContent || !assistantContent) {
      return;
    }

    await this.client.createMemory({
      agentId: this.filters.agentId,
      threadId: this.filters.threadId,
      schemas: this.schemas,
      conversation: [
        { role: "user", content: userContent },
        { role: "assistant", content: assistantContent },
      ],
    });
  }
}

/**
 * Factory function for zkStash memory middleware.
 */
export function zkStashMemoryMiddleware(fields: ZkStashMemoryMiddlewareFields) {
  return new ZkStashMemoryMiddleware(fields);
}
