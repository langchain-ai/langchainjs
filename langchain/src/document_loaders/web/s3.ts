import * as fsDefault from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { Readable } from "node:stream";
import { BaseDocumentLoader } from "../base.js";
import { UnstructuredLoader as UnstructuredLoaderDefault } from "../fs/unstructured.js";

export interface S3LoaderParams {
  bucket: string;
  key: string;
  unstructuredAPIURL: string;
  s3Config?: S3Config;

  fs?: typeof fsDefault;
  UnstructuredLoader?: typeof UnstructuredLoaderDefault;
}

interface S3Config {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class S3Loader extends BaseDocumentLoader {
  private bucket: string;

  private key: string;

  private unstructuredAPIURL: string;

  private s3Config: S3Config;

  private _fs: typeof fsDefault;

  private _UnstructuredLoader: typeof UnstructuredLoaderDefault;

  constructor({
    bucket,
    key,
    unstructuredAPIURL,
    s3Config = {},
    fs = fsDefault,
    UnstructuredLoader = UnstructuredLoaderDefault,
  }: S3LoaderParams) {
    super();
    this.bucket = bucket;
    this.key = key;
    this.unstructuredAPIURL = unstructuredAPIURL;
    this.s3Config = s3Config;
    this._fs = fs;
    this._UnstructuredLoader = UnstructuredLoader;
  }

  public async load() {
    const { S3Client, GetObjectCommand } = await S3LoaderImports();

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
    } catch {
      throw new Error(
        `Failed to download file ${this.key} from S3 bucket ${this.bucket}.`
      );
    }

    try {
      const options = { apiUrl: this.unstructuredAPIURL };
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

async function S3LoaderImports() {
  try {
    const s3Module = await import("@aws-sdk/client-s3");

    return s3Module as typeof s3Module;
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load @aws-sdk/client-s3'. Please install it eg. `yarn add @aws-sdk/client-s3`."
    );
  }
}
