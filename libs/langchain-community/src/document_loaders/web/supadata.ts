import { Document } from "@langchain/core/documents";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base";

export type SupadataOperation = "metadata" | "transcript";

export interface SupadataLoaderParams {
  /** URLs to load (YouTube, web pages, etc.). */
  urls: string[];
  /**
   * Supadata API key. If omitted, falls back to SUPADATA_API_KEY env var.
   */
  apiKey?: string;
  /**
   * Operation to perform. "metadata" returns structured info,
   * "transcript" returns textual content. Default: "transcript".
   */
  operation?: SupadataOperation;
  /** Preferred transcript language, e.g. "en". */
  lang?: string;
  /**
   * If true, return plain-text transcript instead of timestamped chunks.
   * Default: true.
   */
  text?: boolean;
  /** Transcript mode, e.g. "native", "auto", or "generate". */
  mode?: "native" | "auto" | "generate";
  /** Extra parameters forwarded directly to the Supadata SDK. */
  params?: Record<string, unknown>;
}

/**
 * Document loader that wraps the Supadata JavaScript SDK.
 *
 * Supports two operations:
 *  - "transcript": fetch a transcript for the given URL
 *  - "metadata": fetch metadata for the given URL
 *
 * The Supadata API key is read either from the `apiKey` parameter or from
 * the `SUPADATA_API_KEY` environment variable.
 */
export class SupadataLoader extends BaseDocumentLoader {
  private readonly urls: string[];

  private readonly apiKey?: string;

  private readonly operation: SupadataOperation;

  private readonly lang?: string;

  private readonly text: boolean;

  private readonly mode?: "native" | "auto" | "generate";

  private readonly params: Record<string, unknown>;

  constructor(params: SupadataLoaderParams) {
    super();

    if (!params.urls || params.urls.length === 0) {
      throw new Error(
        "SupadataLoader: at least one URL is required in `urls`.",
      );
    }

    this.urls = params.urls;
    this.apiKey = params.apiKey;
    this.operation = params.operation ?? "transcript";
    this.lang = params.lang;
    this.text = params.text ?? true;
    this.mode = params.mode;
    this.params = params.params ?? {};
  }

  async load(): Promise<Document[]> {
    const client = await this.getClient();
    const docs: Document[] = [];

    for (const url of this.urls) {
      try {
        if (this.operation === "metadata") {
          docs.push(await this.loadMetadata(client, url));
        } else if (this.operation === "transcript") {
          docs.push(await this.loadTranscript(client, url));
        } else {
          throw new Error(
            `SupadataLoader: unsupported operation "${this.operation}". Use "metadata" or "transcript".`,
          );
        }
      } catch (e: any) {
        // Surface the failure but keep other URLs processing.
        // eslint-disable-next-line no-console
        console.warn(`SupadataLoader: failed to load ${url}: ${e?.message ?? e}`);
      }
    }

    return docs;
  }

  private resolveApiKey(): string {
    if (this.apiKey) {
      return this.apiKey;
    }

    const envKey = getEnvironmentVariable("SUPADATA_API_KEY");
    if (!envKey) {
      throw new Error(
        "SupadataLoader: Supadata API key not found. Pass `apiKey` to the loader or set the SUPADATA_API_KEY environment variable.",
      );
    }
    return envKey;
  }

  private async getClient(): Promise<any> {
    const apiKey = this.resolveApiKey();

    try {
      const { Supadata } = await import("@supadata/js");
      return new Supadata({ apiKey });
    } catch {
      throw new Error(
        "SupadataLoader: failed to load `@supadata/js`. Please install it with `npm install @supadata/js` (or `pnpm add @supadata/js`).",
      );
    }
  }

  private async loadMetadata(client: any, url: string): Promise<Document> {
    let isYoutube = false;

    try {
      const hostname = new URL(url).hostname.toLowerCase();

      isYoutube =
        hostname === "youtube.com" ||
        hostname === "www.youtube.com" ||
        hostname.endsWith(".youtube.com") ||
        hostname === "youtu.be";
    } catch {
      // If URL parsing fails, treat as non-YouTube
      isYoutube = false;
    }

    let result;
    if (isYoutube && client.youtube?.video) {
      result = await client.youtube.video({ url, ...this.params });
    } else if (client.web?.scrape) {
      result = await client.web.scrape({ url, ...this.params });
    } else {
      throw new Error(
        "SupadataLoader: could not determine a Supadata SDK method to call for metadata. " +
        "Ensure the SDK version exposes either `youtube.video` or `web.scrape`.",
      );
    }

    return new Document({
      pageContent: JSON.stringify(result, null, 2),
      metadata: {
        source: url,
        supadataOperation: "metadata",
      },
    });
  }

  private async loadTranscript(client: any, url: string): Promise<Document> {
    const payload: Record<string, unknown> = {
      url,
      text: this.text,
      ...this.params,
    };

    if (this.lang) {
      payload.lang = this.lang;
    }
    if (this.mode) {
      payload.mode = this.mode;
    }

    const result = await client.transcript(payload);

    if (result.jobId) {
      return new Document({
        pageContent: `Transcript processing. Job ID: ${result.jobId}`,
        metadata: {
          source: url,
          supadataOperation: "transcript_job",
          jobId: result.jobId,
        },
      });
    }

    return new Document({
      pageContent: result.content,
      metadata: {
        source: url,
        supadataOperation: "transcript",
        lang: result.lang,
      },
    });
  }
}
