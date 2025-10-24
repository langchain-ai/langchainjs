import { DocumentInterface } from "@langchain/core/documents";
import { BaseDocumentCompressor } from "@langchain/core/retrievers/document_compressors";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { MixedbreadAIClient, MixedbreadAI } from "@mixedbread-ai/sdk";

type RerankingRequestWithoutInput = Omit<
  MixedbreadAI.RerankingRequest,
  "query" | "input"
>;

/**
 * Interface extending RerankingRequestWithoutInput with additional
 * parameters specific to the MixedbreadAIRerank class.
 */
export interface MixedbreadAIRerankParams
  extends Omit<RerankingRequestWithoutInput, "model"> {
  /**
   * The model to use for reranking. For example "default" or "mixedbread-ai/mxbai-rerank-large-v1".
   * @default {"default"}
   */
  model?: string;

  /**
   * The API key to use.
   * @default {process.env.MXBAI_API_KEY}
   */
  apiKey?: string;

  /**
   * The base URL of the MixedbreadAI API.
   */
  baseUrl?: string;

  /**
   * The maximum number of retries to attempt.
   * @default {3}
   */
  maxRetries?: number;
}

/**
 * Document compressor that uses Mixedbread AI's rerank API.
 *
 * This class utilizes Mixedbread AI's reranking model to reorder a set of documents based on their relevance
 * to a given query. The reranked documents are then used for various applications like search results refinement.
 *
 * @example
 * const reranker = new MixedbreadAIReranker({ apiKey: 'your-api-key' });
 * const documents = [{ pageContent: "To bake bread you need flour" }, { pageContent: "To bake bread you need yeast" }];
 * const query = "What do you need to bake bread?";
 * const result = await reranker.compressDocuments(documents, query);
 * console.log(result);
 *
 * @example
 * const reranker = new MixedbreadAIReranker({
 *   apiKey: 'your-api-key',
 *   model: 'mixedbread-ai/mxbai-rerank-large-v1',
 *   topK: 5,
 *   rankFields: ["title", "content"],
 *   returnInput: true,
 *   maxRetries: 5
 * });
 * const documents = [{ title: "Bread Recipe", content: "To bake bread you need flour" }, { title: "Bread Recipe", content: "To bake bread you need yeast" }];
 * const query = "What do you need to bake bread?";
 * const result = await reranker.rerank(documents, query);
 * console.log(result);
 */
export class MixedbreadAIReranker extends BaseDocumentCompressor {
  lc_secrets = {
    apiKey: "MXBAI_API_KEY",
  };

  requestParams: RerankingRequestWithoutInput;

  maxRetries: number;

  private client: MixedbreadAIClient;

  /**
   * Constructor for MixedbreadAIReranker.
   * @param {Partial<MixedbreadAIRerankParams>} params - An optional object with properties to configure the instance.
   * @throws {Error} If the API key is not provided or found in the environment variables.
   *
   * @example
   * const reranker = new MixedbreadAIReranker({
   *     apiKey: 'your-api-key',
   *     model: 'mixedbread-ai/mxbai-rerank-large-v1',
   *     maxRetries: 5
   * });
   */
  constructor(params?: Partial<MixedbreadAIRerankParams>) {
    super();

    const apiKey = params?.apiKey ?? getEnvironmentVariable("MXBAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        "Mixedbread AI API key not found. Either provide it in the constructor or set the 'MXBAI_API_KEY' environment variable."
      );
    }

    this.maxRetries = params?.maxRetries ?? 3;
    this.requestParams = {
      model: params?.model ?? "default",
      topK: params?.topK,
      rankFields: params?.rankFields,
      returnInput: params?.returnInput,
    };
    this.client = new MixedbreadAIClient({
      apiKey,
      environment: params?.baseUrl,
    });
  }

  /**
   * Compress documents using Mixedbread AI's reranking API.
   *
   * @param {DocumentInterface[]} documents - A list of documents to compress.
   * @param {string} query - The query to use for compressing the documents.

   * @returns {Promise<DocumentInterface[]>} A Promise that resolves to a list of compressed documents.
   *
   * @example
   * const documents = [{ pageContent: "To bake bread you need flour" }, { pageContent: "To bake bread you need yeast" }];
   * const query = "What do you need to bake bread?";
   * const result = await reranker.compressDocuments(documents, query);
   * console.log(result);
   */
  async compressDocuments(
    documents: DocumentInterface[],
    query: string
  ): Promise<DocumentInterface[]> {
    if (documents.length === 0) {
      return [];
    }

    const input = documents.map((doc) => doc.pageContent);

    const result = await this.client.reranking({
      query,
      input,
      ...this.requestParams,
    });

    return result.data.map((document) => {
      const doc = documents[document.index];
      doc.metadata.relevanceScore = document.score;
      return doc;
    });
  }

  /**
   * Reranks a list of documents based on their relevance to a query using the Mixedbread AI API.
   * Returns an ordered list of documents sorted by their relevance to the provided query.
   * @param {Array<string> | DocumentInterface[] | Array<Record<string, unknown>>} documents - A list of documents as strings, DocumentInterfaces, or objects with a `pageContent` key.
   * @param {string} query - The query to use for reranking the documents.
   * @param {RerankingRequestWithoutInput} [options] - Optional parameters for reranking.

   * @returns {Promise<MixedbreadAI.RankedDocument[]>} A Promise that resolves to an ordered list of documents with relevance scores.
   *
   * @example
   * const documents = ["To bake bread you need flour", "To bake bread you need yeast"];
   * const query = "What do you need to bake bread?";
   * const result = await reranker.rerank(documents, query);
   * console.log(result);
   */
  async rerank(
    documents:
      | Array<string>
      | DocumentInterface[]
      | Array<Record<string, unknown>>,
    query: string,
    options?: RerankingRequestWithoutInput
  ): Promise<Array<MixedbreadAI.RankedDocument>> {
    if (documents.length === 0) {
      return [];
    }

    const input =
      typeof documents[0] === "object" && "pageContent" in documents[0]
        ? (documents as DocumentInterface[]).map((doc) => doc.pageContent)
        : (documents as Array<string>);

    const result = await this.client.reranking(
      {
        query,
        input,
        ...this.requestParams,
        ...options,
      },
      {
        maxRetries: this.maxRetries,
      }
    );

    return result.data;
  }
}
