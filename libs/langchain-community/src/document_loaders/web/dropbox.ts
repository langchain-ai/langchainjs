import { files as DropboxFiles } from "dropbox/types/dropbox_types.js";
import { Dropbox, DropboxOptions, DropboxAuth } from "dropbox";

import { BaseDocumentLoader } from "langchain/document_loaders/base";
import { Document } from "langchain/document";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import {
  UnstructuredLoader as UnstructuredLoaderDefault,
  UnstructuredLoaderOptions,
} from "../fs/unstructured.js";

/**
 * Interface representing the configuration options for the {@link DropboxLoader}.
 */
export interface DropboxLoaderConfig {
  /**
   * Options for initializing the Dropbox client.
   * See [Dropbox SDK Documentation](https://dropbox.github.io/dropbox-sdk-js/Dropbox.html#Dropbox__anchor) for details.
   */
  clientOptions: DropboxOptions;
  /**
   * Options for the UnstructuredLoader used to process downloaded files.
   */
  unstructuredOptions: UnstructuredLoaderOptions;
  /**
   * The path to the folder in Dropbox to load files from.
   * Defaults to the root folder if not specified.
   */
  folderPath?: string;
  /**
   * Specific file paths in Dropbox to load.
   * Required if `mode` is set to `"file"`.
   */
  filePaths?: string[];
  /**
   * Whether to recursively traverse folders when `mode` is `"directory"`.
   * Defaults to `false`.
   */
  recursive?: boolean;
  /**
   * Mode of operation: `"file"` to load specific files, `"directory"` to load all files in a directory.
   * Defaults to `"file"`.
   */
  mode?: "file" | "directory";
  /**
   * The UnstructuredLoader class to use for processing files.
   * Defaults to the UnstructuredLoader provided by `langchain`.
   */
  UnstructuredLoader?: typeof UnstructuredLoaderDefault;
}

/**
 * A document loader that retrieves files from Dropbox and processes them into `Document` instances.
 * This loader uses the Dropbox API to download files and the `UnstructuredLoader` to process them.
 *
 * @example
 * ```typescript
 * import { DropboxLoader } from "langchain/document_loaders/web/dropbox";
 *
 * const loader = new DropboxLoader({
 *   clientOptions: {
 *     accessToken: "your-dropbox-access-token",
 *   },
 *   unstructuredOptions: {
 *     apiUrl: "http://localhost:8000/general/v0/general",
 *   },
 *   folderPath: "/path/to/folder",
 *   recursive: true,
 *   mode: "directory",
 * });
 *
 * const docs = await loader.load();
 * ```
 */
export class DropboxLoader extends BaseDocumentLoader {
  /**
   * The Dropbox client instance used to interact with the Dropbox API.
   */
  protected dropboxClient: Dropbox;

  /**
   * Options for the UnstructuredLoader used to process downloaded files.
   */
  protected unstructuredOptions: UnstructuredLoaderOptions;

  /**
   * The path to the folder in Dropbox to load files from.
   */
  protected folderPath: string;

  /**
   * Specific file paths in Dropbox to load.
   */
  protected filePaths: string[];

  /**
   * Whether to recursively traverse folders when `mode` is `"directory"`.
   */
  protected recursive: boolean;

  /**
   * Mode of operation: `"file"` to load specific files, `"directory"` to load all files in a directory.
   */
  protected mode: "file" | "directory";

  /**
   * The UnstructuredLoader class to use for processing files.
   */
  protected _UnstructuredLoader: typeof UnstructuredLoaderDefault;

  /**
   * Creates an instance of `DropboxLoader`.
   * @param config - Configuration options for the loader.
   * @throws Will throw an error if `mode` is `"file"` and `filePaths` is not provided or empty.
   */
  constructor({
    clientOptions,
    unstructuredOptions,
    folderPath = "",
    filePaths,
    recursive = false,
    mode = "file",
    UnstructuredLoader = UnstructuredLoaderDefault,
  }: DropboxLoaderConfig) {
    super();

    if (mode === "file" && (!filePaths || filePaths.length === 0)) {
      throw new Error(`"filePaths" must be set if "mode" is "file".`);
    }

    this.unstructuredOptions = unstructuredOptions;
    this.folderPath = folderPath;
    this.filePaths = filePaths || [];
    this.recursive = recursive;
    this.mode = mode;
    this._UnstructuredLoader = UnstructuredLoader;
    this.dropboxClient = DropboxLoader._getDropboxClient(clientOptions);
  }

  /**
   * Asynchronously loads documents from Dropbox, yielding each `Document` as it is loaded.
   * Useful for handling large numbers of documents without loading them all into memory at once.
   *
   * @returns An async generator yielding `Document` instances.
   */
  public async *loadLazy(): AsyncGenerator<Document> {
    let paths: string[] = [];

    if (this.mode === "file") {
      paths = this.filePaths;
    } else if (this.mode === "directory") {
      paths = await this._fetchFilePathList();
    }

    for (const filePath of paths) {
      const docs = await this._loadFile(filePath);
      for (const doc of docs) {
        yield doc;
      }
    }
  }

  /**
   * Loads all documents from Dropbox based on the specified configuration.
   *
   * @returns A promise that resolves to an array of `Document` instances.
   */
  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    for await (const doc of this.loadLazy()) {
      documents.push(doc);
    }
    return documents;
  }

  /**
   * Generates a list of file paths from the specified Dropbox folder that need to be downloaded
   * and processed into documents. This method is called only when the loader is operating in
   * `"directory"` mode to determine which files should be downloaded and processed.
   *
   * @returns A promise that resolves to an array of Dropbox file paths to be downloaded and processed.
   */
  private async _fetchFilePathList(): Promise<string[]> {
    const client: Dropbox = this.dropboxClient;
    const filePaths: string[] = [];

    /**
     * Processes entries returned from Dropbox and adds file paths to the list.
     * @param entries - Array of Dropbox metadata entries.
     */
    const processEntries = (entries: DropboxFiles.MetadataReference[]) => {
      entries
        .filter((entry) => entry[".tag"] === "file")
        .forEach((fileEntry) => {
          if (fileEntry.path_lower) filePaths.push(fileEntry.path_lower);
        });
    };

    try {
      let listFolderResponse = await client.filesListFolder({
        path: this.folderPath,
        recursive: this.recursive,
      });

      processEntries(listFolderResponse.result.entries);
      while (listFolderResponse.result.has_more) {
        listFolderResponse = await client.filesListFolderContinue({
          cursor: listFolderResponse.result.cursor,
        });
        processEntries(listFolderResponse.result.entries);
      }

      return filePaths;
    } catch (error) {
      console.error(`Error listing files in folder ${this.folderPath}:`, error);
      return [];
    }
  }

  /**
   * Downloads a file from Dropbox, processes it into `Document` instances using the `UnstructuredLoader`,
   * and returns the resulting documents. This method handles the entire lifecycle of the file processing,
   * including downloading, processing, and metadata augmentation.
   *
   * @param filePath - The path to the file in Dropbox.
   * @returns A promise that resolves to an array of `Document` instances generated from a dropbox file.
   */
  private async _loadFile(filePath: string): Promise<Document[]> {
    const client: Dropbox = this.dropboxClient;
    try {
      const fetchRes = await client.filesDownload({ path: filePath });
      const fileMetadata =
        fetchRes.result as DropboxFiles.FileMetadataReference & {
          fileBinary: Buffer;
        };

      if (!fileMetadata.fileBinary) {
        throw new Error(`Failed to download file: ${filePath}`);
      }

      const fileBinary = fileMetadata.fileBinary;

      // Create an unstructured loader and load the file.
      const unstructuredLoader = new this._UnstructuredLoader(
        {
          fileName: fileMetadata.name,
          buffer: fileBinary,
        },
        this.unstructuredOptions
      );
      const docs = await unstructuredLoader.load();

      // Set the source metadata for each document.
      const sourceMetadata = { source: `dropbox://${filePath}` };
      for (const doc of docs) {
        doc.metadata = { ...doc.metadata, ...sourceMetadata };
      }

      return docs;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      console.error(`File ${filePath} was skipped.`);
      return []; // Proceed to the next file
    }
  }

  /**
   * Creates and returns a Dropbox client instance configured with the provided options.
   * If authentication details are not specified in `clientOptions`, it attempts to use
   * the `DROPBOX_ACCESS_TOKEN` environment variable for authentication.
   *
   * @param clientOptions - Configuration options for initializing the Dropbox client,
   *                        including authentication details.
   * @returns An instance of the Dropbox client.
   */
  private static _getDropboxClient(clientOptions: DropboxOptions): Dropbox {
    const options = clientOptions || {};
    if (options.auth || options.accessToken) {
      return new Dropbox(clientOptions);
    }
    const accessToken = getEnvironmentVariable("DROPBOX_ACCESS_TOKEN");
    const auth = new DropboxAuth({
      ...clientOptions,
      accessToken,
    });
    return new Dropbox({ ...clientOptions, auth });
  }
}
