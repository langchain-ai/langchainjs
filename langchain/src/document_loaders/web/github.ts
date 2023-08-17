import ignore, { Ignore } from "ignore";
import binaryExtensions from "binary-extensions";

import { Document } from "../../document.js";
import { BaseDocumentLoader } from "../base.js";
import { UnknownHandling } from "../fs/directory.js";
import { extname } from "../../util/extname.js";
import { getEnvironmentVariable } from "../../util/env.js";
import { AsyncCaller, AsyncCallerParams } from "../../util/async_caller.js";

const extensions = new Set(binaryExtensions);

function isBinaryPath(name: string) {
  return extensions.has(extname(name).slice(1).toLowerCase());
}

export interface GithubFile {
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

interface GetContentResponse {
  contents: string;
  metadata: { source: string };
}

export interface GithubRepoLoaderParams extends AsyncCallerParams {
  branch?: string;
  recursive?: boolean;
  unknown?: UnknownHandling;
  accessToken?: string;
  ignoreFiles?: (string | RegExp)[];
  ignorePaths?: string[];
  verbose?: boolean;
  /**
   * The maximum number of concurrent calls that can be made. Defaults to 2.
   */
  maxConcurrency?: number;
  /**
   * The maximum number of retries that can be made for a single call,
   * with an exponential backoff between each attempt. Defaults to 2.
   */
  maxRetries?: number;
}

export class GithubRepoLoader
  extends BaseDocumentLoader
  implements GithubRepoLoaderParams
{
  private readonly owner: string;

  private readonly repo: string;

  private readonly initialPath: string;

  private headers: Record<string, string> = {};

  public branch: string;

  public recursive: boolean;

  public unknown: UnknownHandling;

  public accessToken?: string;

  public ignoreFiles: (string | RegExp)[];

  public ignore?: Ignore;

  public verbose?: boolean;

  protected caller: AsyncCaller;

  constructor(
    githubUrl: string,
    {
      accessToken = getEnvironmentVariable("GITHUB_ACCESS_TOKEN"),
      branch = "main",
      recursive = true,
      unknown = UnknownHandling.Warn,
      ignoreFiles = [],
      ignorePaths,
      verbose = false,
      maxConcurrency = 2,
      maxRetries = 2,
      ...rest
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
    this.accessToken = accessToken;
    this.ignoreFiles = ignoreFiles;
    this.verbose = verbose;
    this.caller = new AsyncCaller({
      maxConcurrency,
      maxRetries,
      ...rest,
    });
    if (ignorePaths) {
      this.ignore = ignore.default().add(ignorePaths);
    }
    if (this.accessToken) {
      this.headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };
    }
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
    return (await this.processRepo()).map(
      (fileResponse) =>
        new Document({
          pageContent: fileResponse.contents,
          metadata: fileResponse.metadata,
        })
    );
  }

  protected shouldIgnore(path: string, fileType: string): boolean {
    if (fileType !== "dir" && isBinaryPath(path)) {
      return true;
    }
    if (this.ignore !== undefined) {
      return this.ignore.ignores(path);
    }
    return (
      fileType !== "dir" &&
      this.ignoreFiles.some((pattern) => {
        if (typeof pattern === "string") {
          return path === pattern;
        }

        try {
          return pattern.test(path);
        } catch {
          throw new Error(`Unknown ignore file pattern: ${pattern}`);
        }
      })
    );
  }

  /**
   * Takes the file info and wrap it in a promise that will resolve to the file content and metadata
   * @param file
   * @returns
   */
  private async fetchFileContentWrapper(
    file: GithubFile
  ): Promise<GetContentResponse> {
    const fileContent = await this.fetchFileContent(file).catch((error) => {
      this.handleError(`Failed wrap file content: ${file}, ${error}`);
    });
    return {
      contents: fileContent || "",
      metadata: { source: file.path },
    };
  }

  /**
   * Maps a list of files / directories to a list of promises that will fetch the file / directory contents
   */
  private async getCurrentDirectoryFilePromises(
    files: GithubFile[]
  ): Promise<Promise<GetContentResponse>[]> {
    const currentDirectoryFilePromises: Promise<GetContentResponse>[] = [];
    // Directories have nested files / directories, which is why this is a list of promises of promises
    const currentDirectoryDirectoryPromises: Promise<
      Promise<GetContentResponse>[]
    >[] = [];

    for (const file of files) {
      if (!this.shouldIgnore(file.path, file.type)) {
        if (file.type !== "dir") {
          try {
            currentDirectoryFilePromises.push(
              this.fetchFileContentWrapper(file)
            );
          } catch (e) {
            this.handleError(
              `Failed to fetch file content: ${file.path}, ${e}`
            );
          }
        } else if (this.recursive) {
          currentDirectoryDirectoryPromises.push(
            this.processDirectory(file.path)
          );
        }
      }
    }

    const curDirDirectories: Promise<GetContentResponse>[][] =
      await Promise.all(currentDirectoryDirectoryPromises);

    return [...currentDirectoryFilePromises, ...curDirDirectories.flat()];
  }

  /**
   * Begins the process of fetching the contents of the repository
   */
  private async processRepo(): Promise<GetContentResponse[]> {
    try {
      // Get the list of file / directory names in the root directory
      const files = await this.fetchRepoFiles(this.initialPath);
      // Map the file / directory paths to promises that will fetch the file / directory contents
      const currentDirectoryFilePromises =
        await this.getCurrentDirectoryFilePromises(files);
      return Promise.all(currentDirectoryFilePromises);
    } catch (error) {
      this.handleError(
        `Failed to process directory: ${this.initialPath}, ${error}`
      );
      return Promise.reject(error);
    }
  }

  private async processDirectory(
    path: string
  ): Promise<Promise<GetContentResponse>[]> {
    try {
      const files = await this.fetchRepoFiles(path);
      return this.getCurrentDirectoryFilePromises(files);
    } catch (error) {
      this.handleError(`Failed to process directory: ${path}, ${error}`);
      return Promise.reject(error);
    }
  }

  private async fetchRepoFiles(path: string): Promise<GithubFile[]> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${path}?ref=${this.branch}`;
    return this.caller.call(async () => {
      if (this.verbose) {
        console.log("Fetching", url);
      }
      const response = await fetch(url, { headers: this.headers });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          `Unable to fetch repository files: ${
            response.status
          } ${JSON.stringify(data)}`
        );
      }

      if (!Array.isArray(data)) {
        throw new Error("Unable to fetch repository files.");
      }

      return data as GithubFile[];
    });
  }

  private async fetchFileContent(file: GithubFile): Promise<string> {
    return this.caller.call(async () => {
      if (this.verbose) {
        console.log("Fetching", file.download_url);
      }
      const response = await fetch(file.download_url, {
        headers: this.headers,
      });
      return response.text();
    });
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
