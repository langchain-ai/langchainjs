import * as fsDefault from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand, S3ClientConfig } from "@aws-sdk/client-s3";
import { BaseDocumentLoader } from "../base.js";
import { UnstructuredLoader as UnstructuredLoaderDefault } from "../fs/unstructured.js";

/**
 * Represents the configuration options for the S3 client. It extends the
 * S3ClientConfig interface from the "@aws-sdk/client-s3" package and
 * includes additional deprecated properties for access key ID and secret
 * access key.
 */
export type S3Config = S3ClientConfig & {
  /** @deprecated Use the credentials object instead */
  accessKeyId?: string;
  /** @deprecated Use the credentials object instead */
  secretAccessKey?: string;
};

/**
 * Represents the parameters for the S3Loader class. It includes
 * properties such as the S3 bucket, key, unstructured API URL,
 * unstructured API key, S3 configuration, file system module, and
 * UnstructuredLoader module.
 */
export interface S3LoaderParams {
  bucket: string;
  key: string;
  unstructuredAPIURL: string;
  unstructuredAPIKey: string;
  s3Config?: S3Config & {
    /** @deprecated Use the credentials object instead */
    accessKeyId?: string;
    /** @deprecated Use the credentials object instead */
    secretAccessKey?: string;
  };
  fs?: typeof fsDefault;
  UnstructuredLoader?: typeof UnstructuredLoaderDefault;
}

/**
 * A class that extends the BaseDocumentLoader class. It represents a
 * document loader for loading files from an S3 bucket.
 * @example
 * ```typescript
 * const loader = new S3Loader({
 *   bucket: "my-document-bucket-123",
 *   key: "AccountingOverview.pdf",
 *   s3Config: {
 *     region: "us-east-1",
 *     credentials: {
 *       accessKeyId: "<YourAccessKeyId>",
 *       secretAccessKey: "<YourSecretAccessKey>",
 *     },
 *   },
 *   unstructuredAPIURL: "<YourUnstructuredAPIURL>",
 *   unstructuredAPIKey: "<YourUnstructuredAPIKey>",
 * });
 * const docs = await loader.load();
 * ```
 */
export class S3Loader extends BaseDocumentLoader {
  private bucket: string;

  private key: string;

  private unstructuredAPIURL: string;

  private unstructuredAPIKey: string;

  private s3Config: S3Config & {
    /** @deprecated Use the credentials object instead */
    accessKeyId?: string;
    /** @deprecated Use the credentials object instead */
    secretAccessKey?: string;
  };

  private _fs: typeof fsDefault;

  private _UnstructuredLoader: typeof UnstructuredLoaderDefault;

  constructor({
    bucket,
    key,
    unstructuredAPIURL,
    unstructuredAPIKey,
    s3Config = {},
    fs = fsDefault,
    UnstructuredLoader = UnstructuredLoaderDefault,
  }: S3LoaderParams) {
    super();
    this.bucket = bucket;
    this.key = key;
    this.unstructuredAPIURL = unstructuredAPIURL;
    this.unstructuredAPIKey = unstructuredAPIKey;
    this.s3Config = s3Config;
    this._fs = fs;
    this._UnstructuredLoader = UnstructuredLoader;
  }

  /**
   * Loads the file from the S3 bucket, saves it to a temporary directory,
   * and then uses the UnstructuredLoader to load the file as a document.
   * @returns An array of Document objects representing the loaded documents.
   */
  public async load() {
    const tempDir = this._fs.mkdtempSync(
      path.join(os.tmpdir(), "s3fileloader-")
    );

    const filePath = path.join(tempDir, this.key);

    try {
      const s3Client = new S3Client(this.s3Config);

      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
      });

      const response = await s3Client.send(getObjectCommand);

      const objectData = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];

        // eslint-disable-next-line no-instanceof/no-instanceof
        if (response.Body instanceof Readable) {
          response.Body.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.Body.on("end", () => resolve(Buffer.concat(chunks)));
          response.Body.on("error", reject);
        } else {
          reject(new Error("Response body is not a readable stream."));
        }
      });

      this._fs.mkdirSync(path.dirname(filePath), { recursive: true });

      this._fs.writeFileSync(filePath, objectData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      throw new Error(
        `Failed to download file ${this.key} from S3 bucket ${this.bucket}: ${e.message}`
      );
    }

    try {
      const options = {
        apiUrl: this.unstructuredAPIURL,
        apiKey: this.unstructuredAPIKey,
      };

      const unstructuredLoader = new this._UnstructuredLoader(
        filePath,
        options
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
