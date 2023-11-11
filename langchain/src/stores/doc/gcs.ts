import { Storage, File } from "@google-cloud/storage";

import { Document } from "../../document.js";
import { Docstore } from "../../schema/index.js";

/**
 * Interface that defines the configuration for the
 * GoogleCloudStorageDocstore. It includes the bucket name and an optional
 * prefix.
 */
export interface GoogleCloudStorageDocstoreConfiguration {
  /** The identifier for the GCS bucket */
  bucket: string;

  /**
   * An optional prefix to prepend to each object name.
   * Often used to create a pseudo-hierarchy.
   */
  prefix?: string;
}

/**
 * Class that provides an interface for interacting with Google Cloud
 * Storage (GCS) as a document store. It extends the Docstore class and
 * implements methods to search, add, and add a document to the GCS
 * bucket.
 */
export class GoogleCloudStorageDocstore extends Docstore {
  bucket: string;

  prefix = "";

  storage: Storage;

  constructor(config: GoogleCloudStorageDocstoreConfiguration) {
    super();

    this.bucket = config.bucket;
    this.prefix = config.prefix ?? this.prefix;

    this.storage = new Storage();
  }

  /**
   * Searches for a document in the GCS bucket and returns it as a Document
   * instance.
   * @param search The name of the document to search for in the GCS bucket
   * @returns A Promise that resolves to a Document instance representing the found document
   */
  async search(search: string): Promise<Document> {
    const file = this.getFile(search);

    const [fileMetadata] = await file.getMetadata();
    const metadata = fileMetadata?.metadata;

    const [dataBuffer] = await file.download();
    const pageContent = dataBuffer.toString();

    const ret = new Document({
      pageContent,
      metadata,
    });

    return ret;
  }

  /**
   * Adds multiple documents to the GCS bucket.
   * @param texts An object where each key is the name of a document and the value is the Document instance to be added
   * @returns A Promise that resolves when all documents have been added
   */
  async add(texts: Record<string, Document>): Promise<void> {
    await Promise.all(
      Object.keys(texts).map((key) => this.addDocument(key, texts[key]))
    );
  }

  /**
   * Adds a single document to the GCS bucket.
   * @param name The name of the document to be added
   * @param document The Document instance to be added
   * @returns A Promise that resolves when the document has been added
   */
  async addDocument(name: string, document: Document): Promise<void> {
    const file = this.getFile(name);
    await file.save(document.pageContent);
    await file.setMetadata({ metadata: document.metadata });
  }

  /**
   * Gets a file from the GCS bucket.
   * @param name The name of the file to get from the GCS bucket
   * @returns A File instance representing the fetched file
   */
  private getFile(name: string): File {
    const filename = this.prefix + name;
    const file = this.storage.bucket(this.bucket).file(filename);
    return file;
  }
}
