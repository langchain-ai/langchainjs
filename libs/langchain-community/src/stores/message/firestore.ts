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
  collectionName: string;
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

  private collectionName: string;

  private sessionId: string;

  private userId: string;

  private appIdx: number;

  private config: AppOptions;

  private firestoreClient: Firestore;

  private document: DocumentReference<DocumentData> | null;

  constructor({
    collectionName,
    sessionId,
    userId,
    appIdx = 0,
    config,
  }: FirestoreDBChatMessageHistory) {
    super();
    this.collectionName = collectionName;
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

    this.document = this.firestoreClient
      .collection(this.collectionName)
      .doc(this.sessionId);
  }

  private _addCollectionsAndDocsToDocument(options: {
    collections: string[];
    docs: string[];
  }): DocumentReference<DocumentData> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    if (options.collections.length !== options.docs.length) {
      throw new Error("Collections and docs options must have the same length");
    }

    const newDocument = options.collections.reduce<
      DocumentReference<DocumentData>
    >(
      (acc, collection, index) =>
        acc.collection(collection).doc(options.docs[index]),
      this.document
    );

    return newDocument;
  }

  /**
   * Method to retrieve all messages from the Firestore collection
   * associated with the current session. Returns an array of BaseMessage
   * objects.
   * @returns Array of stored messages
   */
  async getMessages(options?: {
    collections: string[];
    docs: string[];
  }): Promise<BaseMessage[]> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    let newDocument = this.document;

    if (options) {
      newDocument = this._addCollectionsAndDocsToDocument(options);
    }

    const querySnapshot = await newDocument
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
  public async addMessage(message: BaseMessage, options?: {
    collections: string[];
    docs: string[];
  }) {
    const messages = mapChatMessagesToStoredMessages([message]);
    await this.upsertMessage(messages[0], options);
  }

  private async upsertMessage(message: StoredMessage, options?: {
    collections: string[];
    docs: string[];
  }): Promise<void> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    let newDocument = this.document;
    if (options) {
      newDocument = this._addCollectionsAndDocsToDocument(options);
    }

    await newDocument.set(
      {
        id: this.sessionId,
        user_id: this.userId,
      },
      { merge: true }
    );
    await newDocument
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
  public async clear(options?: {
    collections: string[];
    docs: string[];
  }): Promise<void> {
    if (!this.document) {
      throw new Error("Document not initialized");
    }

    let newDocument = this.document;
    if (options) {
      newDocument = this._addCollectionsAndDocsToDocument(options);
    }

    await newDocument
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
    await newDocument.delete().catch((err) => {
      throw new Error(`Unknown response type: ${err.toString()}`);
    });
  }
}
