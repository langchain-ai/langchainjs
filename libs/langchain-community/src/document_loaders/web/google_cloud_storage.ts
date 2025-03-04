import { Storage, StorageOptions } from "@google-cloud/storage";
import * as os from "node:os";
import * as path from "node:path";
import * as fsDefault from "node:fs";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";
import { Document } from "@langchain/core/documents";
import {
  UnstructuredLoaderOptions,
  UnstructuredLoader,
} from "../fs/unstructured.js";

/**
 * Represents the parameters for the GoogleCloudStorageLoader class. It includes
 * properties such as the GCS bucket, file destination, the options for the UnstructuredLoader and
 * the options for Google Cloud Storage
 */
export type GcsLoaderConfig = {
  fs?: typeof fsDefault;
  bucket: string;
  file: string;
  unstructuredLoaderOptions: UnstructuredLoaderOptions;
  storageOptions: StorageOptions;
};

/**
 * A class that extends the BaseDocumentLoader class. It represents a
 * document loader for loading files from a google cloud storage bucket.
 * @example
 * ```typescript
 * const loader = new GoogleCloudStorageLoader({
 *   bucket: "<my-bucket-name>",
 *   file: "<file-path>",
 *   storageOptions: {
 *     keyFilename: "<key-file-name-path>"
 *   }
 *   unstructuredConfig: {
 *     apiUrl: "<unstructured-API-URL>",
 *     apiKey: "<unstructured-API-key>"
 *   }
 * });
 * const docs = await loader.load();
 * ```
 */
export class GoogleCloudStorageLoader extends BaseDocumentLoader {
  private bucket: string;

  private file: string;

  private storageOptions: StorageOptions;

  private _fs: typeof fsDefault;

  private unstructuredLoaderOptions: UnstructuredLoaderOptions;

  constructor({
    fs = fsDefault,
    file,
    bucket,
    unstructuredLoaderOptions,
    storageOptions,
  }: GcsLoaderConfig) {
    super();
    this._fs = fs;
    this.bucket = bucket;
    this.file = file;
    this.unstructuredLoaderOptions = unstructuredLoaderOptions;
    this.storageOptions = storageOptions;
  }

  async load(): Promise<Document<Record<string, any>>[]> {
    const tempDir = this._fs.mkdtempSync(
      path.join(os.tmpdir(), "googlecloudstoragefileloader-")
    );
    const filePath = path.join(tempDir, this.file);

    try {
      const storage = new Storage(this.storageOptions);
      const bucket = storage.bucket(this.bucket);

      const [buffer] = await bucket.file(this.file).download();
      this._fs.mkdirSync(path.dirname(filePath), { recursive: true });

      this._fs.writeFileSync(filePath, buffer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new Error(
        `Failed to download file ${this.file} from google cloud storage bucket ${this.bucket}: ${e.message}`
      );
    }

    try {
      const unstructuredLoader = new UnstructuredLoader(
        filePath,
        this.unstructuredLoaderOptions
      );
      const docs = await unstructuredLoader.load();
      return docs;
    } catch {
      throw new Error(
        `Failed to load file ${filePath} using unstructured loader.`
      );
    }
  }
}
