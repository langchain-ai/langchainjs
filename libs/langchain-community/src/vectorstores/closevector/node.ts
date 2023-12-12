import {
  CloseVectorHNSWNode,
  HierarchicalNSWT,
  CloseVectorHNSWLibArgs,
  CloseVectorCredentials,
} from "closevector-node";

import { Embeddings } from "@langchain/core/embeddings";
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
    embeddings: Embeddings,
    args: CloseVectorNodeArgs,
    credentials?: CloseVectorCredentials
  ) {
    super(embeddings, args, credentials);
    if (args.instance) {
      this.instance = args.instance;
    } else {
      this.instance = new CloseVectorHNSWNode(embeddings, args);
    }
    if (this.credentials?.key) {
      this.instance.accessKey = this.credentials.key;
    }
    if (this.credentials?.secret) {
      this.instance.secret = this.credentials.secret;
    }
  }

  /**
   * Method to save the index to the CloseVector CDN.
   * @param options
   * @param options.description A description of the index.
   * @param options.public Whether the index should be public or private. Defaults to false.
   * @param options.uuid A UUID for the index. If not provided, a new index will be created.
   * @param options.onProgress A callback function that will be called with the progress of the upload.
   */
  async saveToCloud(
    options: Parameters<CloseVectorHNSWNode["saveToCloud"]>[0]
  ) {
    await this.instance.saveToCloud(options);
  }

  /**
   * Method to load the index from the CloseVector CDN.
   * @param options
   * @param options.uuid The UUID of the index to be downloaded.
   * @param options.credentials The credentials to be used by the CloseVectorNode instance.
   * @param options.embeddings The embeddings to be used by the CloseVectorNode instance.
   * @param options.onProgress A callback function that will be called with the progress of the download.
   */
  static async loadFromCloud(
    options: Omit<
      Parameters<(typeof CloseVectorHNSWNode)["loadFromCloud"]>[0] & {
        embeddings: Embeddings;
        credentials: CloseVectorCredentials;
      },
      "accessKey" | "secret"
    >
  ) {
    if (!options.credentials.key || !options.credentials.secret) {
      throw new Error("key and secret must be provided");
    }
    const instance = await CloseVectorHNSWNode.loadFromCloud({
      ...options,
      accessKey: options.credentials.key,
      secret: options.credentials.secret,
    });
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
    embeddings: Embeddings,
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
    embeddings: Embeddings,
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
    embeddings: Embeddings,
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
