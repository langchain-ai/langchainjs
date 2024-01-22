import type { AppOptions } from "firebase-admin";
import { getApps, initializeApp } from "firebase-admin/app";
import {
  getFirestore,
  DocumentData,
  Firestore,
  DocumentReference,
  FieldValue,
} from "firebase-admin/firestore";

import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import {
  BaseMessage,
  StoredMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";

/**
 * Interface for FirestoreDBChatMessageHistory. It includes the collection
 * name, session ID, user ID, and optionally, the app index and
 * configuration for the Firebase app.
 */
export interface FirestoreDBChatMessageHistory {
  /**
   * An array of collection names, should match the length of `docs` field.
   */
  collections?: string[];
  /**
   * An array of doc names, should match the length of `collections` field.
   */
  docs?: string[];
  /**
   * @deprecated Will be removed in 0.1 use `collections` field instead.
   */
  collectionName?: string;
  sessionId: string;
  userId: string;
  appIdx?: number;
  config?: AppOptions;
}
/**
 * Class for managing chat message history using Google's Firestore as a
 * storage backend. Extends the BaseListChatMessageHistory class.
 * @example
 * ```typescript
 * const chatHistory = new FirestoreChatMessageHistory({
 *   collectionName: "langchain",
 *   sessionId: "lc-example",
 *   userId: "a@example.com",
 *   config: { projectId: "your-project-id" },
 * });
 *
 * const chain = new ConversationChain({
 *   llm: new ChatOpenAI(),
 *   memory: new BufferMemory({ chatHistory }),
 * });
 *
 * const response = await chain.invoke({
 *   input: "What did I just say my name was?",
 * });
 * console.log({ response });
 * ```
 */
export class FirestoreChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "firestore"];

  private collections: string[];

  private docs: string[];

  private sessionId: string;

  private userId: string;

  private appIdx: number;

  private config: AppOptions;

  private firestoreClient: Firestore;

  private document: DocumentReference<DocumentData> | null;

  constructor({
    collectionName,
    collections,
    docs,
    sessionId,
    userId,
    appIdx = 0,
    config,
  }: FirestoreDBChatMessageHistory) {
    super();
    if (collectionName && collections) {
      throw new Error(
        "Can not pass in collectionName and collections. Please use collections only."
      );
    }
    if (!collectionName && !collections) {
      throw new Error(
        "Must pass in a collections. Fields `collectionName` and `collections` are both undefined."
      );
    }
    if (collections || docs) {
      // If the collections length does not match docs length, and the collections list
      // does not have a length of 1 (in this case we assume the sessionId is the only doc)
      // throw an error.
      if (collections?.length !== docs?.length && collections?.length !== 1) {
        throw new Error(
          "Collections and docs options must have the same length"
        );
      }
    }

    this.collections = collections || ([collectionName] as string[]);
    this.docs = docs || ([sessionId] as string[]);
    this.sessionId = sessionId;
    this.userId = userId;
    this.document = null;
    this.appIdx = appIdx;
    if (config) this.config = config;

    try {
      this.ensureFirestore();
    } catch (error) {
      throw new Error(`Unknown response type`);
    }
  }

  private ensureFirestore(): void {
    let app;
    // Check if the app is already initialized else get appIdx
    if (!getApps().length) app = initializeApp(this.config);
    else app = getApps()[this.appIdx];

    this.firestoreClient = getFirestore(app);

    this.document = this.collections.reduce<DocumentReference<DocumentData>>(
      (acc, collection, index) =>
        acc.collection(collection).doc(this.docs[index]),
      this.firestoreClient as unknown as DocumentReference<DocumentData>
    );
  }

  /**
   * Method to retrieve all messages from the Firestore collection
   * associated with the current session. Returns an array of BaseMessage
   * objects.
   * @returns Array of stored messages
   */
  async getMessages(): Promise<BaseMessage[]> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    const querySnapshot = await this.document
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get()
      .catch((err) => {
        throw new Error(`Unknown response type: ${err.toString()}`);
      });

    const response: StoredMessage[] = [];
    querySnapshot.forEach((doc) => {
      const { type, data } = doc.data();
      response.push({ type, data });
    });

    return mapStoredMessagesToChatMessages(response);
  }

  /**
   * Method to add a new message to the Firestore collection. The message is
   * passed as a BaseMessage object.
   * @param message The message to be added as a BaseMessage object.
   */
  public async addMessage(message: BaseMessage) {
    const messages = mapChatMessagesToStoredMessages([message]);
    await this.upsertMessage(messages[0]);
  }

  private async upsertMessage(message: StoredMessage): Promise<void> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    await this.document.set(
      {
        id: this.sessionId,
        user_id: this.userId,
      },
      { merge: true }
    );
    await this.document
      .collection("messages")
      .add({
        type: message.type,
        data: message.data,
        createdBy: this.userId,
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch((err) => {
        throw new Error(`Unknown response type: ${err.toString()}`);
      });
  }

  /**
   * Method to delete all messages from the Firestore collection associated
   * with the current session.
   */
  public async clear(): Promise<void> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    await this.document
      .collection("messages")
      .get()
      .then((querySnapshot) => {
        querySnapshot.docs.forEach((snapshot) => {
          snapshot.ref.delete().catch((err) => {
            throw new Error(`Unknown response type: ${err.toString()}`);
          });
        });
      })
      .catch((err) => {
        throw new Error(`Unknown response type: ${err.toString()}`);
      });
    await this.document.delete().catch((err) => {
      throw new Error(`Unknown response type: ${err.toString()}`);
    });
  }
}
