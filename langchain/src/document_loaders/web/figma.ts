import { BaseDocumentLoader } from "../base.js";
import { Document } from "../../document.js";

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

export interface FigmaLoaderParams {
  accessToken?: string;
  ids: string;
  key: string;
}

export class FigmaFileLoader
  extends BaseDocumentLoader
  implements FigmaLoaderParams
{
  public accessToken?: string;

  public ids: string;

  public key: string;

  private headers: Record<string, string> = {};

  constructor({
    accessToken = typeof process !== "undefined"
      ? // eslint-disable-next-line no-process-env
        process.env?.FIGMA_ACCESS_TOKEN
      : undefined,
    ids,
    key,
  }: FigmaLoaderParams) {
    super();

    this.accessToken = accessToken;
    this.ids = ids;
    this.key = key;

    if (this.accessToken) {
      this.headers = {
        "X-Figma-Token": this.accessToken,
      };
    }
  }

  private constructFigmaApiURL(): string {
    return `https://api.figma.com/v1/files/${this.key}/nodes?ids=${this.ids}`;
  }

  private async getFigmaFile(): Promise<FigmaFile> {
    const url = this.constructFigmaApiURL();
    const response = await fetch(url, { headers: this.headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Unable to get figma file ${response.status} ${JSON.stringify(data)}`
      );
    }

    if (!data) {
      throw new Error("Unable to get file");
    }

    return data as FigmaFile;
  }

  public async load(): Promise<Document[]> {
    const data = await this.getFigmaFile();
    const text = JSON.stringify(data);
    const metadata = { source: this.constructFigmaApiURL() };

    return [new Document({ pageContent: text, metadata })];
  }
}
