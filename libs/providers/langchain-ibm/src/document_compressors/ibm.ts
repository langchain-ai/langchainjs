import { DocumentInterface } from "@langchain/core/documents";
import { BaseDocumentCompressor } from "@langchain/core/retrievers/document_compressors";
import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import { TextRerankParams } from "@ibm-cloud/watsonx-ai/dist/watsonx-ai-ml/vml_v1.js";
import {
  WatsonxAuth,
  WatsonxRerankBasicOptions,
  WatsonxValidationError,
} from "../types.js";
import { initWatsonxOrGatewayInstance } from "../utils/ibm.js";

export interface WatsonxInputRerank
  extends
    Omit<TextRerankParams, "modelId" | "inputs" | "query">,
    WatsonxRerankBasicOptions {
  model: string;
  truncateInputTokens?: number;
  returnOptions?: {
    topN?: number;
    inputs?: boolean;
  };
}
/**
 * IBM Watsonx.ai document reranker for improving search relevance.
 * 
 * Uses cross-encoder models to rerank documents based on their relevance to a query.
 * This is particularly useful for improving retrieval quality in RAG applications.
 * 
 * @example Basic reranking with project ID
 * ```typescript
 * import { WatsonxRerank } from "@langchain/ibm";
 * import { Document } from "@langchain/core/documents";
 * 
 * const reranker = new WatsonxRerank({
 *   model: "cross-encoder/ms-marco-minilm-l-12-v2",
 *   projectId: "your-project-id",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: process.env.WATSONX_AI_APIKEY,
 * });
 * 
 * const query = "What is machine learning?";
 * const documents = [
 *   new Document({ pageContent: "Machine learning is a subset of AI" }),
 *   new Document({ pageContent: "The weather is nice today" }),
 *   new Document({ pageContent: "Deep learning uses neural networks" }),
 * ];
 * 
 * const rerankedDocs = await reranker.compressDocuments(documents, query);
 * console.log(rerankedDocs); // Documents sorted by relevance
 * ```
 * 
 * @example Limiting results with topN
 * ```typescript
 * const reranker = new WatsonxRerank({
 *   model: "cross-encoder/ms-marco-minilm-l-12-v2",
 *   projectId: "your-project-id",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: process.env.WATSONX_AI_APIKEY,
 *   returnOptions: {
 *     topN: 3, // Return only top 3 most relevant documents
 *   },
 * });
 * ```
 * 
 * @example Using with space ID
 * ```typescript
 * const reranker = new WatsonxRerank({
 *   model: "cross-encoder/ms-marco-minilm-l-12-v2",
 *   spaceId: "your-space-id",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: process.env.WATSONX_AI_APIKEY,
 * });
 * ```
 * 
 * @example Integration with retrieval chain
 * ```typescript
 * import { createRetrievalChain } from "langchain/chains/retrieval";
 * import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
 * 
 * const retriever = vectorStore.asRetriever();
 * const reranker = new WatsonxRerank({
 *   model: "cross-encoder/ms-marco-minilm-l-12-v2",
 *   projectId: "your-project-id",
 *   serviceUrl: "https://us-south.ml.cloud.ibm.com",
 *   apiKey: process.env.WATSONX_AI_APIKEY,
 * });
 * 
 * // Use reranker as a document compressor
 * const compressedRetriever = retriever.pipe(reranker);
 * ```
 */
export class WatsonxRerank
  extends BaseDocumentCompressor
  implements WatsonxInputRerank
{
  maxRetries = 0;

  version = "2024-05-31";

  truncateInputTokens?: number | undefined;

  returnOptions?:
    | { topN?: number; inputs?: boolean; query?: boolean }
    | undefined;

  model: string;

  spaceId?: string | undefined;

  projectId?: string | undefined;

  maxConcurrency?: number | undefined;

  serviceUrl: string;

  service: WatsonXAI;

  constructor(fields: WatsonxInputRerank & WatsonxAuth) {
    super();
    if (fields.projectId && fields.spaceId)
      throw new WatsonxValidationError(
        "Maximum 1 id type can be specified per instance",
      );

    if (!fields.projectId && !fields.spaceId)
      throw new WatsonxValidationError(
        "No id specified! At least id of 1 type has to be specified",
      );
    this.model = fields.model;
    this.serviceUrl = fields.serviceUrl;
    this.version = fields.version;
    this.projectId = fields?.projectId;
    this.spaceId = fields?.spaceId;
    this.maxRetries = fields.maxRetries ?? this.maxRetries;
    this.maxConcurrency = fields.maxConcurrency;
    this.truncateInputTokens = fields.truncateInputTokens;
    this.returnOptions = fields.returnOptions;

    this.service = initWatsonxOrGatewayInstance(fields);
  }

  scopeId() {
    if (this.projectId)
      return { projectId: this.projectId, modelId: this.model };
    else return { spaceId: this.spaceId, modelId: this.model };
  }

  invocationParams(options?: Partial<WatsonxInputRerank>) {
    return {
      truncate_input_tokens:
        options?.truncateInputTokens ?? this.truncateInputTokens,
      return_options: {
        top_n: options?.returnOptions?.topN ?? this.returnOptions?.topN,
        inputs: options?.returnOptions?.inputs ?? this.returnOptions?.inputs,
      },
    };
  }

  async compressDocuments(
    documents: DocumentInterface[],
    query: string
  ): Promise<DocumentInterface[]> {
    const caller = new AsyncCaller({
      maxConcurrency: this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const inputs = documents.map((document) => ({
      text: document.pageContent,
    }));
    const { result } = await caller.call(() =>
      this.service.textRerank({
        ...this.scopeId(),
        inputs,
        query,
        parameters: {
          truncate_input_tokens: this.truncateInputTokens,
        },
      })
    );
    const resultDocuments = result.results.map(({ index, score }) => {
      const rankedDocument = documents[index];
      rankedDocument.metadata.relevanceScore = score;
      return rankedDocument;
    });
    return resultDocuments;
  }

  async rerank(
    documents: Array<
      DocumentInterface | string | Record<"pageContent", string>
    >,
    query: string,
    options?: Partial<WatsonxInputRerank>
  ): Promise<Array<{ index: number; relevanceScore: number; input?: string }>> {
    const inputs = documents.map((document) => {
      if (typeof document === "string") {
        return { text: document };
      }
      return { text: document.pageContent };
    });

    const caller = new AsyncCaller({
      maxConcurrency: this.maxConcurrency,
      maxRetries: this.maxRetries,
    });
    const { result } = await caller.call(() =>
      this.service.textRerank({
        ...this.scopeId(),
        inputs,
        query,
        parameters: this.invocationParams(options),
      })
    );
    const response = result.results.map((document) => {
      return document?.input
        ? {
            index: document.index,
            relevanceScore: document.score,
            input: document?.input.text,
          }
        : {
            index: document.index,
            relevanceScore: document.score,
          };
    });
    return response;
  }
}
