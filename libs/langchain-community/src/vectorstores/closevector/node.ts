import {
  CloseVectorHNSWNode,
  HierarchicalNSWT,
  CloseVectorHNSWLibArgs,
  CloseVectorCredentials,
} from "closevector-node";

import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";

import { CloseVector } from "./common.js";

/**
 * package closevector-node is largely based on hnswlib.ts in the current folder with the following exceptions:
 * 1. It uses a modified version of hnswlib-node to ensure the generated index can be loaded by closevector_web.ts.
 * 2. It adds features to upload and download the index to/from the CDN provided by CloseVector.
 *
 * For more information, check out https://closevector-docs.getmegaportal.com/
 */

/**
 * Arguments for creating a CloseVectorNode instance, extending CloseVectorHNSWLibArgs.
 */
export interface CloseVectorNodeArgs
  extends CloseVectorHNSWLibArgs<HierarchicalNSWT> {
  space: "cosine" | "l2" | "ip";
  instance?: CloseVectorHNSWNode;
}

/**
 * Class that implements a vector store using Hierarchical Navigable Small
 * World (HNSW) graphs. It extends the SaveableVectorStore class and
 * provides methods for adding documents and vectors, performing
 * similarity searches, and saving and loading the vector store.
 */
export class CloseVectorNode extends CloseVector<CloseVectorHNSWNode> {
  declare FilterType: (doc: Document) => boolean;

  constructor(
    embeddings: EmbeddingsInterface,
    args: CloseVectorNodeArgs,
    credentials?: CloseVectorCredentials
  ) {
    super(embeddings, args, credentials);
    if (args.instance) {
      this.instance = args.instance;
    } else {
      this.instance = new CloseVectorHNSWNode(embeddings, args);
    }
  }

  uuid() {
    return this.instance.uuid;
  }

  /**
   * Method to save the index to the CloseVector CDN.
   * @param options.uuid after uploading the index to the CloseVector CDN, the uuid of the index can be obtained by instance.uuid
   * @param options.credentials the credentials to be used to access the CloseVector API
   * @param options.onProgress a callback function to track the upload progress
   * @param options.public a boolean to determine if the index should be public or private, if not provided, the index will be private. If the index is public, it can be accessed by anyone with the uuid.
   * @param options.description a description of the index
   */
  async saveToCloud(options: {
    uuid?: string;
    public?: boolean;
    description?: string;
    credentials?: CloseVectorCredentials;
    onProgress?: (progress: { loaded: number; total: number }) => void;
  }) {
    await this.instance.saveToCloud({
      ...options,
      credentials: options.credentials || this.credentials,
    });
  }

  /**
   * Method to load the index from the CloseVector CDN.
   * @param options.uuid after uploading the index to the CloseVector CDN, the uuid of the index can be obtained by instance.uuid
   * @param options.credentials the credentials to be used to access the CloseVector API
   * @param options.onProgress a callback function to track the download progress
   * @param options.embeddings the embeddings to be used by the CloseVectorWeb instance
   */
  static async loadFromCloud(options: {
    embeddings: EmbeddingsInterface;
    uuid: string;
    credentials?: CloseVectorCredentials;
    onProgress?: (progress: { loaded: number; total: number }) => void;
  }) {
    const instance = await CloseVectorHNSWNode.loadFromCloud(options);
    const vectorstore = new this(
      options.embeddings,
      instance.args,
      options.credentials
    );
    return vectorstore;
  }

  /**
   * Static method to load a vector store from a directory. It reads the
   * HNSW index, the arguments, and the document store from the directory,
   * then creates a new HNSWLib instance with these values.
   * @param directory The directory from which to load the vector store.
   * @param embeddings The embeddings to be used by the CloseVectorNode instance.
   * @returns A Promise that resolves to a new CloseVectorNode instance.
   */
  static async load(
    directory: string,
    embeddings: EmbeddingsInterface,
    credentials?: CloseVectorCredentials
  ) {
    const instance = await CloseVectorHNSWNode.load(directory, embeddings);
    const vectorstore = new this(embeddings, instance.args, credentials);
    return vectorstore;
  }

  /**
   * Static method to create a new CloseVectorWeb instance from texts and metadata.
   * It creates a new Document instance for each text and metadata, then
   * calls the fromDocuments method to create the CloseVectorWeb instance.
   * @param texts The texts to be used to create the documents.
   * @param metadatas The metadata to be used to create the documents.
   * @param embeddings The embeddings to be used by the CloseVectorWeb instance.
   * @param args An optional configuration object for the CloseVectorWeb instance.
   * @param credential An optional credential object for the CloseVector API.
   * @returns A Promise that resolves to a new CloseVectorWeb instance.
   */
  static async fromTexts(
    texts: string[],
    metadatas: object[] | object,
    embeddings: EmbeddingsInterface,
    args?: Record<string, unknown>,
    credential?: CloseVectorCredentials
  ): Promise<CloseVectorNode> {
    const docs = CloseVector.textsToDocuments(texts, metadatas);
    return await CloseVectorNode.fromDocuments(
      docs,
      embeddings,
      args,
      credential
    );
  }

  /**
   * Static method to create a new CloseVectorNode instance from documents. It
   * creates a new CloseVectorNode instance, adds the documents to it, then returns
   * the instance.
   * @param docs The documents to be added to the HNSWLib instance.
   * @param embeddings The embeddings to be used by the HNSWLib instance.
   * @param args An optional configuration object for the HNSWLib instance.
   * @param credentials An optional credential object for the CloseVector API.
   * @returns A Promise that resolves to a new CloseVectorNode instance.
   */
  static async fromDocuments(
    docs: Document[],
    embeddings: EmbeddingsInterface,
    args?: Record<string, unknown>,
    credentials?: CloseVectorCredentials
  ): Promise<CloseVectorNode> {
    const _args: Record<string, unknown> = args || {
      space: "cosine",
    };
    const instance = new this(
      embeddings,
      _args as unknown as CloseVectorNodeArgs,
      credentials
    );
    await instance.addDocuments(docs);
    return instance;
  }

  static async imports(): Promise<{
    HierarchicalNSW: typeof HierarchicalNSWT;
  }> {
    return CloseVectorHNSWNode.imports();
  }
}
