import AlchemystAI from "@alchemystai/sdk";
import { Document } from "@langchain/core/documents";
import { BaseRetriever, type BaseRetrieverInput } from "@langchain/core/retrievers";

export interface AlchemystRetrieverConfig extends BaseRetrieverInput {
  apiKey: string;
  similarityThreshold?: number;
  minimumSimilarityThreshold?: number;
  scope?: "external" | "internal";
  metadata?: Record<string, unknown>;
}

/**
 * A retriever implementation for LangChain that integrates with the Alchemyst AI SDK. Refer https://docs.getalchemystai.com for more detailed docs.
 *
 * This class allows you to use Alchemyst's context search as a retriever in LangChain pipelines.
 * It supports configurable similarity thresholds, scope, and metadata filtering.
 *
 * @example
 * ```typescript
 * const retriever = new AlchemystRetriever({
 *   apiKey: process.env.ALCHEMYST_AI_API_KEY!,
 *   similarityThreshold: 0.8,
 *   minimumSimilarityThreshold: 0.5,
 *   scope: "internal",
 *   metadata: { fileType: "text/plain" }
 * });
 * const docs = await retriever.getRelevantDocuments("search query");
 * ```
 *
 * @extends BaseRetriever
 */
export class AlchemystRetriever extends BaseRetriever {
  /**
   * The logical component namespace for this retriever.
   * Used internally by LangChain.
   */
  override lc_namespace: string[] = ["alchemyst", "retrievers"];

  /**
   * The Alchemyst AI SDK client instance.
   */
  client: AlchemystAI;

  /**
   * The similarity threshold for context search.
   * Only results with similarity above this value will be returned.
   * @default 0.8
   */
  similarityThreshold?: number;

  /**
   * The minimum similarity threshold for context search.
   * Results below this value will be filtered out.
   * @default 0.5
   */
  minimumSimilarityThreshold?: number;

  /**
   * The scope for context search.
   * Can be used to restrict search to a specific context (e.g., "internal").
   * @default "internal"
   */
  scope?: string;

  /**
   * Optional metadata filter for context search.
   * Only documents matching this metadata will be considered.
   * @default undefined
   */
  override metadata?: Record<string, unknown>;

  /**
   * Returns the logical component name for this retriever.
   * @returns The string "AlchemystRetriever".
   */
  static override lc_name(): string {
    return "AlchemystRetriever";
  }

  /**
   * Returns the secret keys required for this retriever.
   * @returns An object mapping secret names to environment variable names.
   */
  override get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "ALCHEMYST_AI_API_KEY",
    };
  }

  /**
   * Constructs a new AlchemystRetriever.
   *
   * @param config - Configuration options for the retriever, including API key, thresholds, scope, and metadata.
   */
  constructor(config: AlchemystRetrieverConfig) {
    super(config);
    this.client = new AlchemystAI({ apiKey: config.apiKey });
    this.similarityThreshold = config.similarityThreshold ?? 0.8;
    this.minimumSimilarityThreshold = config.minimumSimilarityThreshold ?? 0.5;
    this.scope = config.scope ?? "internal" as any;
    this.metadata = config.metadata;
  }

  /**
   * Retrieves relevant documents from Alchemyst based on the provided query.
   *
   * @param query - The search query string.
   * @returns A promise that resolves to an array of Document objects relevant to the query.
   */
  public override async _getRelevantDocuments(query: string): Promise<Document[]> {
    const results = await this.client.v1.context.search({
      query,
      similarity_threshold: this.similarityThreshold ?? 0.8,
      minimum_similarity_threshold: this.minimumSimilarityThreshold ?? 0.5,
      scope: this.scope as never,
      metadata: this.metadata,
    });

    return (results.contexts??[]).map((match: any) => {
      return new Document({
        pageContent: match.content,
        metadata: match.metadata,
      });
    });
  }
}
