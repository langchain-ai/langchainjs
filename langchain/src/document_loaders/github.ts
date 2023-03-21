import { Document } from "../document.js";
import { BaseDocumentLoader } from "./base.js";
import { UnknownHandling } from "./directory.js";

interface GithubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

export interface GithubRepoLoaderParams {
  branch?: string;
  recursive?: boolean;
  unknown?: UnknownHandling;
}

export class GithubRepoLoader
  extends BaseDocumentLoader
  implements GithubRepoLoaderParams
{
  private readonly owner: string;

  private readonly repo: string;

  private readonly initialPath: string;

  public branch: string;

  public recursive: boolean;

  public unknown: UnknownHandling;

  constructor(
    githubUrl: string,
    {
      branch = "main",
      recursive = true,
      unknown = UnknownHandling.Warn,
    }: GithubRepoLoaderParams = {}
  ) {
    super();
    const { owner, repo, path } = this.extractOwnerAndRepoAndPath(githubUrl);
    this.owner = owner;
    this.repo = repo;
    this.initialPath = path;
    this.branch = branch;
    this.recursive = recursive;
    this.unknown = unknown;
  }

  private extractOwnerAndRepoAndPath(url: string): {
    owner: string;
    repo: string;
    path: string;
  } {
    const match = url.match(
      /https:\/\/github.com\/([^/]+)\/([^/]+)(\/tree\/[^/]+\/(.+))?/i
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
            this.handleError(
              `Failed to fetch file content: ${file.path}, ${e}`
            );
          }
        }
      }
    } catch (error) {
      this.handleError(`Failed to process directory: ${path}, ${error}`);
    }
  }

  private async fetchRepoFiles(path: string): Promise<GithubFile[]> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        `Unable to fetch repository files: ${response.status} ${JSON.stringify(
          data
        )}`
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("Unable to fetch repository files.");
    }

    return data as GithubFile[];
  }

  private async fetchFileContent(file: GithubFile): Promise<string> {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (
      fileExtension === "jpg" ||
      fileExtension === "jpeg" ||
      fileExtension === "png" ||
      fileExtension === "gif" ||
      fileExtension === "svg" ||
      fileExtension === "srt" ||
      fileExtension === "pdf"
    ) {
      return "";
    }

    const response = await fetch(file.download_url);
    return response.text();
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
