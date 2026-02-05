import { promises as fs } from "node:fs";
import { dirname } from "node:path";

import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

export const FILE_HISTORY_DEFAULT_FILE_PATH = ".history/history.json";

/**
 * Represents a lightweight file chat session.
 */
export type FileChatSession = {
  id: string;
  context: Record<string, unknown>;
};

/**
 * Represents a stored chat session.
 */
export type StoredFileChatSession = FileChatSession & {
  messages: StoredMessage[];
};

/**
 * Type for the store of chat sessions.
 */
export type FileChatStore = {
  [userId: string]: Record<string, StoredFileChatSession>;
};

/**
 * Type for the input to the `FileSystemChatMessageHistory` constructor.
 */
export interface FileSystemChatMessageHistoryInput {
  sessionId: string;
  userId?: string;
  filePath?: string;
}

let store: FileChatStore;

/**
 * Store chat message history using a local JSON file.
 * For demo and development purposes only.
 *
 * @example
 * ```typescript
 *  const model = new ChatOpenAI({
 *   model: "gpt-3.5-turbo",
 *   temperature: 0,
 * });
 * const prompt = ChatPromptTemplate.fromMessages([
 *   [
 *     "system",
 *     "You are a helpful assistant. Answer all questions to the best of your ability.",
 *   ],
 *   ["placeholder", "chat_history"],
 *   ["human", "{input}"],
 * ]);
 *
 * const chain = prompt.pipe(model).pipe(new StringOutputParser());
 * const chainWithHistory = new RunnableWithMessageHistory({
 *   runnable: chain,
 *  inputMessagesKey: "input",
 *  historyMessagesKey: "chat_history",
 *   getMessageHistory: async (sessionId) => {
 *     const chatHistory = new FileSystemChatMessageHistory({
 *       sessionId: sessionId,
 *       userId: "userId",  // Optional
 *     })
 *     return chatHistory;
 *   },
 * });
 * await chainWithHistory.invoke(
 *   { input: "What did I just say my name was?" },
 *   { configurable: { sessionId: "session-id" } }
 * );
 * ```
 */
export class FileSystemChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "file"];

  private sessionId: string;

  private userId: string;

  private filePath: string;

  constructor(chatHistoryInput: FileSystemChatMessageHistoryInput) {
    super();

    this.sessionId = chatHistoryInput.sessionId;
    this.userId = chatHistoryInput.userId ?? "";
    this.filePath = chatHistoryInput.filePath ?? FILE_HISTORY_DEFAULT_FILE_PATH;
  }

  private async init(): Promise<void> {
    if (store) {
      return;
    }
    try {
      store = await this.loadStore();
    } catch (error) {
      console.error("Error initializing FileSystemChatMessageHistory:", error);
      throw error;
    }
  }

  protected async loadStore(): Promise<FileChatStore> {
    try {
      const store = await fs.readFile(this.filePath, "utf-8");
      return JSON.parse(store) as FileChatStore;
    } catch (_error) {
      const error = _error as NodeJS.ErrnoException;
      if (error.code === "ENOENT") {
        return {};
      }
      throw new Error(
        `Error loading FileSystemChatMessageHistory store: ${error}`
      );
    }
  }

  protected async saveStore(): Promise<void> {
    try {
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(store));
    } catch (error) {
      throw new Error(
        `Error saving FileSystemChatMessageHistory store: ${error}`
      );
    }
  }

  async getMessages(): Promise<BaseMessage[]> {
    await this.init();
    const messages = store[this.userId]?.[this.sessionId]?.messages ?? [];
    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    await this.init();
    const messages = await this.getMessages();
    messages.push(message);
    const storedMessages = mapChatMessagesToStoredMessages(messages);
    store[this.userId] ??= {};
    store[this.userId][this.sessionId] = {
      ...store[this.userId][this.sessionId],
      messages: storedMessages,
    };
    await this.saveStore();
  }

  async clear(): Promise<void> {
    await this.init();
    if (store[this.userId]) {
      delete store[this.userId][this.sessionId];
    }
    await this.saveStore();
  }

  async getContext(): Promise<Record<string, unknown>> {
    await this.init();
    return store[this.userId]?.[this.sessionId]?.context ?? {};
  }

  async setContext(context: Record<string, unknown>): Promise<void> {
    await this.init();
    store[this.userId] ??= {};
    store[this.userId][this.sessionId] = {
      ...store[this.userId][this.sessionId],
      context,
    };
    await this.saveStore();
  }

  async clearAllSessions() {
    await this.init();
    delete store[this.userId];
    await this.saveStore();
  }

  async getAllSessions(): Promise<FileChatSession[]> {
    await this.init();
    const userSessions = store[this.userId]
      ? Object.entries(store[this.userId]).map(([id, session]) => ({
          id,
          context: session.context,
        }))
      : [];
    return userSessions;
  }
}
