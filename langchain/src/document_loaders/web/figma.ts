import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";
import { getEnvironmentVariable } from "../../util/env.js";

/**
 * Interface representing a Figma file. It includes properties for the
 * file name, role, last modified date, editor type, thumbnail URL,
 * version, document node, schema version, main file key, and an array of
 * branches.
 */
export interface FigmaFile {
  name: string;
  role: string;
  lastModified: string;
  editorType: string;
  thumbnailUrl: string;
  version: string;
  document: Node;
  schemaVersion: number;
  mainFileKey: string;
  branches: Array<{
    key: string;
    name: string;
    thumbnail_url: string;
    last_modified: string;
    link_access: string;
  }>;
}

/**
 * Interface representing the parameters for configuring the FigmaLoader.
 * It includes optional properties for the access token, an array of node
 * IDs, and the file key.
 */
export interface FigmaLoaderParams {
  accessToken?: string;
  nodeIds: string[];
  fileKey: string;
}

/**
 * Class representing a document loader for loading Figma files. It
 * extends the BaseDocumentLoader and implements the FigmaLoaderParams
 * interface. The constructor takes a config object as a parameter, which
 * contains the access token, an array of node IDs, and the file key.
 * @example
 * ```typescript
 * const loader = new FigmaFileLoader({
 *   accessToken: "FIGMA_ACCESS_TOKEN",
 *   nodeIds: ["id1", "id2", "id3"],
 *   fileKey: "key",
 * });
 * const docs = await loader.load();
 * ```
 */
export class FigmaFileLoader
  extends BaseDocumentLoader
  implements FigmaLoaderParams
{
  public accessToken?: string;

  public nodeIds: string[];

  public fileKey: string;

  private headers: Record<string, string> = {};

  constructor({
    accessToken = getEnvironmentVariable("FIGMA_ACCESS_TOKEN"),
    nodeIds,
    fileKey,
  }: FigmaLoaderParams) {
    super();

    this.accessToken = accessToken;
    this.nodeIds = nodeIds;
    this.fileKey = fileKey;

    if (this.accessToken) {
      this.headers = {
        "x-figma-token": this.accessToken,
      };
    }
  }

  /**
   * Constructs the URL for the Figma API call.
   * @returns The constructed URL as a string.
   */
  private constructFigmaApiURL(): string {
    return `https://api.figma.com/v1/files/${
      this.fileKey
    }/nodes?ids=${this.nodeIds.join(",")}`;
  }

  /**
   * Fetches the Figma file using the Figma API and returns it as a
   * FigmaFile object.
   * @returns A Promise that resolves to a FigmaFile object.
   */
  private async getFigmaFile(): Promise<FigmaFile> {
    const url = this.constructFigmaApiURL();
    const response = await fetch(url, { headers: this.headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Unable to get figma file: ${response.status} ${JSON.stringify(data)}`
      );
    }

    if (!data) {
      throw new Error("Unable to get file");
    }

    return data as FigmaFile;
  }

  /**
   * Fetches the Figma file using the Figma API, creates a Document instance
   * with the JSON representation of the file as the page content and the
   * API URL as the metadata, and returns it.
   * @returns A Promise that resolves to an array of Document instances.
   */
  public async load(): Promise<Document[]> {
    const data = await this.getFigmaFile();
    const text = JSON.stringify(data);
    const metadata = { source: this.constructFigmaApiURL() };

    return [new Document({ pageContent: text, metadata })];
  }
}
