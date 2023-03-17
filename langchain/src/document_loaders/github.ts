import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";


export enum UnknownHandling {
  Ignore = "ignore",
  Warn = "warn",
  Error = "error",
}


export class GithubRepoLoader extends BaseDocumentLoader {
  private owner: string;
  private repo: string;
  private initialPath: string;
  public branch: string;
  public recursive: boolean;
  public unknown: UnknownHandling;

  constructor(
    githubUrl: string,
    branch: string = "main",
    recursive: boolean = true,
    unknown: UnknownHandling = UnknownHandling.Warn
  ) {
    super();
    const { owner, repo, path } = this.extractOwnerAndRepoAndPath(githubUrl);
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.recursive = recursive;
    this.unknown = unknown;
    this.initialPath = path;
  }

  private extractOwnerAndRepoAndPath(url: string): {
    owner: string;
    repo: string;
    path: string;
  } {
    const match = url.match(
      /https:\/\/github.com\/([^\/]+)\/([^\/]+)(\/tree\/[^\/]+\/(.+))?/i
    );

    if (!match) {
      throw new Error("Invalid GitHub URL format.");
    }

    return { owner: match[1], repo: match[2], path: match[4] || "" };
  }

  public async load(): Promise<Document[]> {
    const documents: Document[] = [];
    await this.processDirectory(this.initialPath, documents);
    return documents;
  }

  private async processDirectory(
    path: string,
    documents: Document[]
  ): Promise<void> {
    try {
      const files = await this.fetchRepoFiles(path);

      for (const file of files) {
        if (file.type === "dir") {
          if (this.recursive) {
            await this.processDirectory(file.path, documents);
          }
        } else {
          try {
            const fileContent = await this.fetchFileContent(file);
            const metadata = { source: file.path };
            documents.push(
              new Document({ pageContent: fileContent, metadata })
            );
          } catch (e) {
            this.handleError(`Failed to fetch file content: ${file.path}`);
          }
        }
      }
    } catch (error) {
      this.handleError(`Failed to process directory: ${path}`);
    }
  }

  private async fetchRepoFiles(path: string): Promise<any[]> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Unable to fetch repository files.");
    }

    return data;
  }

  private async fetchFileContent(file: any): Promise<string> {
    // Check if the file has a MIME type that starts with "image/" or "application/pdf"
    if (
      file.mime &&
      (file.mime.startsWith("image/") || file.mime === "application/pdf")
    ) {
      return "";
    }

    // Get the file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    // Ignore .srt and .pdf files
    if (fileExtension === "srt" || fileExtension === "pdf") {
      return "";
    }

    const response = await fetch(file.download_url);
    const content = await response.text();

    return content;
  }

  private handleError(message: string): void {
    switch (this.unknown) {
      case UnknownHandling.Ignore:
        break;
      case UnknownHandling.Warn:
        console.warn(message);
        break;
      case UnknownHandling.Error:
        throw new Error(message);
      default:
        throw new Error(`Unknown unknown handling: ${this.unknown}`);
    }
  }
}
