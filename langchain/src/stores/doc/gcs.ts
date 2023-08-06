import { Storage, File } from "@google-cloud/storage";

import { Document } from "../../document.js";
import { Docstore } from "../../schema/index.js";

export interface GoogleCloudStorageDocstoreConfiguration {
  /** The identifier for the GCS bucket */
  bucket: string;

  /**
   * An optional prefix to prepend to each object name.
   * Often used to create a pseudo-hierarchy.
   */
  prefix?: string;
}

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

  async add(texts: Record<string, Document>): Promise<void> {
    await Promise.all(
      Object.keys(texts).map((key) => this.addDocument(key, texts[key]))
    );
  }

  async addDocument(name: string, document: Document): Promise<void> {
    const file = this.getFile(name);
    await file.save(document.pageContent);
    await file.setMetadata({ metadata: document.metadata });
  }

  private getFile(name: string): File {
    const filename = this.prefix + name;
    const file = this.storage.bucket(this.bucket).file(filename);
    return file;
  }
}
