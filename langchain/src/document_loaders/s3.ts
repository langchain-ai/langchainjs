import fsDefault from "fs";
import path from "path";
import os from "os";
import { BaseDocumentLoader } from "./base.js";
import { UnstructuredLoader as UnstructuredLoaderDefault } from "./unstructured.js";

export class S3Loader extends BaseDocumentLoader {
  private bucket: string;

  private key: string;

  private unstructuredAPIURL: string;

  private _fs: typeof fsDefault;

  private _UnstructuredLoader: typeof UnstructuredLoaderDefault;

  constructor(
    bucket: string,
    key: string,
    unstructuredAPIURL: string,
    _fs = fsDefault,
    _UnstructuredLoader = UnstructuredLoaderDefault
  ) {
    super();
    this.bucket = bucket;
    this.key = key;
    this.unstructuredAPIURL = unstructuredAPIURL;
    this._fs = _fs;
    this._UnstructuredLoader = _UnstructuredLoader;
  }

  public async load() {
    const { S3Client, GetObjectCommand } = await S3LoaderImports();

    const tempDir = this._fs.mkdtempSync(
      path.join(os.tmpdir(), "s3fileloader-")
    );

    const filePath = path.join(tempDir, this.key);

    try {
      const s3Client = new S3Client();

      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
      });

      const response = await s3Client.send(getObjectCommand);

      const objectData = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        response.Body.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.Body.on("end", () => resolve(Buffer.concat(chunks)));
        response.Body.on("error", reject);
      });

      this._fs.mkdirSync(path.dirname(filePath), { recursive: true });

      this._fs.writeFileSync(filePath, objectData);

      console.log(
        `Downloaded file ${this.key} from S3 bucket ${this.bucket} to ${filePath}`
      );
    } catch {
      throw new Error(
        `Failed to download file ${this.key} from S3 bucket ${this.bucket}.`
      );
    }

    try {
      const unstructuredLoader = new this._UnstructuredLoader(
        this.unstructuredAPIURL,
        filePath
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await import("@aws-sdk/client-s3" as any);
  } catch (e) {
    console.error(e);
    throw new Error(
      "Failed to load @aws-sdk/client-s3'. Please install it eg. `yarn add @aws-sdk/client-s3`."
    );
  }
}
