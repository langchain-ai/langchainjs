import * as firebaseAdmin from "firebase-admin";
import { getApps, initializeApp } from "firebase-admin/app";

import {
  getFirestore,
  DocumentData,
  Firestore,
  DocumentReference,
  FieldValue,
} from "firebase-admin/firestore";
import {
  StoredMessage,
  BaseMessage,
  BaseListChatMessageHistory,
} from "../../schema/index.js";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils.js";

export interface FirestoreDBChatMessageHistory {
  collectionName: string;
  sessionId: string;
  userId: string;
  appIdx?: number;
  config?: firebaseAdmin.AppOptions;
}
export class FirestoreChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "firestore"];

  private collectionName: string;

  private sessionId: string;

  private userId: string;

  private appIdx: number;

  private config: firebaseAdmin.AppOptions;

  private firestoreClient: Firestore;

  private document: DocumentReference<DocumentData> | null;

  private messages: BaseMessage[];

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
    this.messages = [];
    if (config) this.config = config;

    try {
      this.prepareFirestore();
    } catch (error) {
      throw new Error(`Unknown response type`);
    }
  }

  private prepareFirestore(): void {
    let app;
    // Check if the app is already initialized else get appIdx
    if (!getApps().length) app = initializeApp(this.config);
    else app = getApps()[this.appIdx];

    this.firestoreClient = getFirestore(app);

    this.document = this.firestoreClient
      .collection(this.collectionName)
      .doc(this.sessionId);
  }

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

    if (response.length > 0) {
      this.messages = mapStoredMessagesToChatMessages(response);
    }

    return this.messages;
  }

  protected async addMessage(message: BaseMessage) {
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
    this.document
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

  public async clear(): Promise<void> {
    this.messages = [];
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
